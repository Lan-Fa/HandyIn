export function qrContent(qrToken: string): string {
  return `handyin://student/${qrToken}`;
}
