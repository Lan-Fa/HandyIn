import { describe, expect, it, vi } from 'vitest';
import { broadcast, subscribe, subscriberCount, unsubscribe } from '../../src/lib/realtime.js';

function makeSocket(readyState = 1) {
  return { readyState, OPEN: 1, send: vi.fn() } as unknown as WebSocket;
}

describe('realtime', () => {
  it('订阅与订阅数统计', () => {
    const s = makeSocket();
    subscribe('a1', s);
    expect(subscriberCount('a1')).toBe(1);
    unsubscribe('a1', s);
    expect(subscriberCount('a1')).toBe(0);
  });

  it('广播向订阅者发送 JSON', () => {
    const s = makeSocket();
    subscribe('a1', s);
    broadcast('a1', { type: 'submission' });
    expect(s.send).toHaveBeenCalledWith(JSON.stringify({ type: 'submission' }));
  });

  it('未打开连接的订阅者不接收消息', () => {
    const s = makeSocket(0); // 0 = 非 OPEN
    subscribe('a1', s);
    broadcast('a1', { type: 'submission' });
    expect(s.send).not.toHaveBeenCalled();
  });

  it('多个订阅者均收到广播，未订阅者不收到', () => {
    const a = makeSocket();
    const b = makeSocket();
    const c = makeSocket();
    subscribe('a1', a);
    subscribe('a1', b);
    broadcast('a1', { x: 1 });
    expect(a.send).toHaveBeenCalledTimes(1);
    expect(b.send).toHaveBeenCalledTimes(1);
    expect(c.send).not.toHaveBeenCalled();
  });

  it('退订后不再接收广播', () => {
    const s = makeSocket();
    subscribe('a1', s);
    unsubscribe('a1', s);
    broadcast('a1', { x: 1 });
    expect(s.send).not.toHaveBeenCalled();
  });
});