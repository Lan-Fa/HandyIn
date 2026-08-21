import { describe, expect, it } from 'vitest';
import { generateQrToken, parseQrContent, qrContent } from '../../src/lib/qrcode.js';

describe('generateQrToken', () => {
  it('生成 32 位十六进制 token', () => {
    expect(generateQrToken()).toMatch(/^[a-f0-9]{32}$/);
  });

  it('多次生成结果不同', () => {
    const a = generateQrToken();
    const b = generateQrToken();
    expect(a).not.toBe(b);
  });
});

describe('qrContent / parseQrContent', () => {
  it('编码解码往返一致', () => {
    const token = generateQrToken();
    expect(parseQrContent(qrContent(token))).toBe(token);
  });

  it('去除首尾空白后再解析', () => {
    expect(parseQrContent('  handyin://student/abcdef01  ')).toBe('abcdef01');
  });

  it('接受大写 hex', () => {
    expect(parseQrContent('handyin://student/ABCDEF01')).toBe('ABCDEF01');
  });

  it('非法内容返回 null', () => {
    expect(parseQrContent('handyin://student/xyz')).toBeNull();
    expect(parseQrContent('https://example.com/abc')).toBeNull();
    expect(parseQrContent('')).toBeNull();
  });
});