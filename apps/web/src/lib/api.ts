import type { ApiError } from '@handyin/types';

export const BASE_URL = import.meta.env.BASE_URL; // 以 / 结尾，如 '/handyin/'
export const BASE_PATH = BASE_URL.replace(/\/+$/, ''); // 如 '/handyin'
export const API_BASE = `${BASE_PATH}/api`;

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body,
      credentials: 'include',
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK', '网络连接失败');
  }

  if (res.status === 204) return undefined as T;

  const data = (await res.json().catch(() => ({}))) as T & ApiError;

  if (!res.ok) {
    const err = data as unknown as ApiError;
    throw new ApiRequestError(res.status, err.error ?? 'UNKNOWN', err.message ?? '请求失败');
  }

  return data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body as BodyInit | undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body as BodyInit | undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
};

export function wsUrl(assignmentId: string): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${BASE_PATH}/ws?assignmentId=${encodeURIComponent(assignmentId)}`;
}
