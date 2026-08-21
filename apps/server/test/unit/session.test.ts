import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupSessions, createSession, destroySession, getSession } from '../../src/lib/session.js';

describe('session', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupSessions();
  });

  it('创建会话返回 token 与未来过期时间', () => {
    const { token, expiresAt } = createSession({ userId: 'u1', role: 'TEACHER', username: 't' });
    expect(token).toBeTruthy();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('有效 token 可取回会话数据', () => {
    const { token } = createSession({ userId: 'u1', role: 'ADMIN', username: 'admin' });
    const session = getSession(token);
    expect(session).toMatchObject({ userId: 'u1', role: 'ADMIN', username: 'admin' });
  });

  it('无效或缺失 token 返回 null', () => {
    expect(getSession(undefined)).toBeNull();
    expect(getSession('nonexistent')).toBeNull();
  });

  it('销毁后无法再取回', () => {
    const { token } = createSession({ userId: 'u1', role: 'TEACHER', username: 't' });
    destroySession(token);
    expect(getSession(token)).toBeNull();
  });

  it('过期会话返回 null 并被清理', () => {
    const { token } = createSession({ userId: 'u1', role: 'TEACHER', username: 't' });
    vi.advanceTimersByTime(8 * 24 * 60 * 60 * 1000); // 超过 7 天 TTL
    expect(getSession(token)).toBeNull();
  });
});