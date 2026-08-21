import { describe, expect, it } from 'vitest';
import { parseCsvText, parseXlsxBuffer, validateImportRows } from '../../src/lib/import.js';

describe('parseCsvText', () => {
  it('解析基本两列 CSV', () => {
    const rows = parseCsvText('2026010101,张三\n2026010102,李四\n');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ row: 1, studentNumber: '2026010101', name: '张三' });
    expect(rows[1]).toEqual({ row: 2, studentNumber: '2026010102', name: '李四' });
  });

  it('支持带引号的字段（含逗号与引号）', () => {
    const rows = parseCsvText('"2026010101","张,三"\n"2026010102","欧阳""锋"');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.name).toBe('张,三');
    expect(rows[1]!.name).toBe('欧阳"锋');
  });

  it('跳过空行，仅空字段被过滤', () => {
    const rows = parseCsvText('2026010101,张三\n\n   \n2026010102,李四');
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.studentNumber)).toEqual(['2026010101', '2026010102']);
  });

  it('空输入返回空数组', () => {
    expect(parseCsvText('')).toEqual([]);
  });

  it('字段两侧空白被去除', () => {
    const rows = parseCsvText(' 2026010101 , 张三 ');
    expect(rows[0]).toEqual({ row: 1, studentNumber: '2026010101', name: '张三' });
  });
});

describe('validateImportRows', () => {
  it('合法行进入 valid', () => {
    const preview = validateImportRows(
      [{ row: 1, studentNumber: '2026010101', name: '张三' }],
      new Set(),
    );
    expect(preview.total).toBe(1);
    expect(preview.valid).toHaveLength(1);
    expect(preview.issues).toHaveLength(0);
  });

  it('非法学号标记 invalid_number', () => {
    const preview = validateImportRows(
      [{ row: 1, studentNumber: 'abc', name: '张三' }],
      new Set(),
    );
    expect(preview.issues[0]).toMatchObject({ row: 1, reason: 'invalid_number' });
  });

  it('缺失姓名标记 missing_name', () => {
    const preview = validateImportRows(
      [{ row: 1, studentNumber: '2026010101', name: '' }],
      new Set(),
    );
    expect(preview.issues[0]).toMatchObject({ row: 1, reason: 'missing_name' });
  });

  it('文件内重复标记 duplicate_in_file', () => {
    const preview = validateImportRows(
      [
        { row: 1, studentNumber: '2026010101', name: '张三' },
        { row: 2, studentNumber: '2026010101', name: '李四' },
      ],
      new Set(),
    );
    expect(preview.valid).toHaveLength(1);
    expect(preview.issues[0]).toMatchObject({ row: 2, reason: 'duplicate_in_file' });
  });

  it('数据库中已存在标记 duplicate_in_db', () => {
    const preview = validateImportRows(
      [{ row: 1, studentNumber: '2026010101', name: '张三' }],
      new Set(['2026010101']),
    );
    expect(preview.valid).toHaveLength(0);
    expect(preview.issues[0]).toMatchObject({ row: 1, reason: 'duplicate_in_db' });
  });
});

describe('parseXlsxBuffer', () => {
  it('解析最小 Excel 内容', async () => {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([
      ['2026010101', '张三'],
      ['2026010102', '李四'],
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Sheet1');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });

    const rows = parseXlsxBuffer(buffer as unknown as Buffer);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ row: 1, studentNumber: '2026010101', name: '张三' });
  });

  it('空表返回空数组', async () => {
    const XLSX = await import('xlsx');
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([]), 'Sheet1');
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
    expect(parseXlsxBuffer(buffer as unknown as Buffer)).toEqual([]);
  });
});