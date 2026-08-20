import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 默认使用 Argon2id；参数遵循 OWASP 推荐（19MiB, t=2, p=1）
export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
