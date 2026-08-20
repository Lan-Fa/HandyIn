import type { WebSocket } from '@fastify/websocket';

const subscribers = new Map<string, Set<WebSocket>>();

export function subscribe(assignmentId: string, socket: WebSocket): void {
  let set = subscribers.get(assignmentId);
  if (!set) {
    set = new Set();
    subscribers.set(assignmentId, set);
  }
  set.add(socket);
}

export function unsubscribe(assignmentId: string, socket: WebSocket): void {
  const set = subscribers.get(assignmentId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) subscribers.delete(assignmentId);
}

export function broadcast(assignmentId: string, payload: unknown): void {
  const set = subscribers.get(assignmentId);
  if (!set) return;
  const message = JSON.stringify(payload);
  for (const socket of set) {
    if (socket.readyState === socket.OPEN) {
      try {
        socket.send(message);
      } catch {
        /* ignore */
      }
    }
  }
}

export function subscriberCount(assignmentId: string): number {
  return subscribers.get(assignmentId)?.size ?? 0;
}
