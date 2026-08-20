import crypto from 'node:crypto';
import type { Role } from '@handyin/types';

export interface SessionData {
  userId: string;
  role: Role;
  username: string;
  expiresAt: number;
}

export const SESSION_COOKIE = 'handyin_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

const sessions = new Map<string, SessionData>();

export function createSession(data: { userId: string; role: Role; username: string }): {
  token: string;
  expiresAt: number;
} {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(token, { ...data, expiresAt });
  return { token, expiresAt };
}

export function getSession(token: string | undefined): SessionData | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token: string | undefined): void {
  if (token) sessions.delete(token);
}

export function cleanupSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}
