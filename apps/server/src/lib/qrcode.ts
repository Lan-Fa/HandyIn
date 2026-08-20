import crypto from 'node:crypto';

export function generateQrToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function qrContent(qrToken: string): string {
  return `handyin://student/${qrToken}`;
}

export function parseQrContent(content: string): string | null {
  const match = /^handyin:\/\/student\/([a-f0-9]+)$/i.exec(content.trim());
  return match ? match[1]! : null;
}
