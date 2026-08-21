import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';

describe('passwords', () => {
  it('哈希值包含 argon2 前缀且不等于明文', async () => {
    const hash = await hashPassword('secret-password');
    expect(hash).toContain('$argon2');
    expect(hash).not.toBe('secret-password');
  });

  it('相同密码两次哈希结果不同（盐）', async () => {
    const a = await hashPassword('secret-password');
    const b = await hashPassword('secret-password');
    expect(a).not.toBe(b);
  });

  it('正确密码验证通过，错误密码验证失败', async () => {
    const hash = await hashPassword('secret-password');
    expect(await verifyPassword(hash, 'secret-password')).toBe(true);
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('非法哈希验证失败而不抛出', async () => {
    expect(await verifyPassword('not-a-valid-hash', 'password')).toBe(false);
  });
});