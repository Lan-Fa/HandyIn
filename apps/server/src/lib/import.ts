import * as XLSX from 'xlsx';
import { parseStudentNumber, STUDENT_NUMBER_REGEX } from '@handyin/validation';
import type { ImportPreview, ImportRow, ImportValidationIssue } from '@handyin/types';

interface RawRow {
  row: number;
  studentNumber: string;
  name: string;
}

export function parseCsvText(text: string): RawRow[] {
  const rows: RawRow[] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;

  const flushField = () => {
    record.push(field);
    field = '';
  };
  const flushRecord = () => {
    flushField();
    if (record.length >= 2) {
      rows.push({
        row: rows.length + 1,
        studentNumber: record[0]?.trim() ?? '',
        name: record[1]?.trim() ?? '',
      });
    }
    record = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      flushField();
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      flushRecord();
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) flushRecord();

  return rows.filter((r) => r.studentNumber !== '' || r.name !== '');
}

export function parseXlsxBuffer(buffer: Buffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
  const rows: RawRow[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    if (!Array.isArray(line) || line.length < 2) continue;
    const studentNumber = String(line[0] ?? '').trim();
    const name = String(line[1] ?? '').trim();
    if (studentNumber === '' && name === '') continue;
    rows.push({ row: rows.length + 1, studentNumber, name });
  }
  return rows;
}

export function validateImportRows(raw: RawRow[], existingNumbers: Set<string>): ImportPreview {
  const valid: ImportRow[] = [];
  const issues: ImportValidationIssue[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    const hasName = r.name !== '';
    const validNumber = STUDENT_NUMBER_REGEX.test(r.studentNumber) && parseStudentNumber(r.studentNumber) !== null;

    if (!validNumber) {
      issues.push({ row: r.row, studentNumber: r.studentNumber, name: r.name, reason: 'invalid_number' });
    } else if (!hasName) {
      issues.push({ row: r.row, studentNumber: r.studentNumber, name: r.name, reason: 'missing_name' });
    } else if (seen.has(r.studentNumber)) {
      issues.push({ row: r.row, studentNumber: r.studentNumber, name: r.name, reason: 'duplicate_in_file' });
    } else if (existingNumbers.has(r.studentNumber)) {
      issues.push({ row: r.row, studentNumber: r.studentNumber, name: r.name, reason: 'duplicate_in_db' });
    } else {
      seen.add(r.studentNumber);
      valid.push({ studentNumber: r.studentNumber, name: r.name });
    }
  }

  return {
    total: raw.length,
    validCount: valid.length,
    issueCount: issues.length,
    valid,
    issues,
  };
}
