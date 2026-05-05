import type {
  ClaimResponse,
  LoginResponse,
  OrderDetailResponse,
  OrdersListResponse,
  PatchStatusResponse,
} from './types';
import { getApiBase } from '../config';

const JSON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export async function loginRequest(login: string, password: string): Promise<LoginResponse> {
  const base = getApiBase();
  if (!base) {
    throw new ApiError('Не задан EXPO_PUBLIC_API_URL в .env', 0, {});
  }
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ login, password }),
  });
  const body = (await parseBody(res)) as LoginResponse & { error?: string };
  if (!res.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
      res.status,
      body
    );
  }
  if (!body.token) {
    throw new ApiError('В ответе нет token', res.status, body);
  }
  return body;
}

export async function fetchOrders(token: string): Promise<OrdersListResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/orders`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = (await parseBody(res)) as OrdersListResponse & { error?: string };
  if (!res.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
      res.status,
      body
    );
  }
  return body;
}

export async function fetchOrder(token: string, id: string): Promise<OrderDetailResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/orders/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = (await parseBody(res)) as OrderDetailResponse & { error?: string };
  if (!res.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
      res.status,
      body
    );
  }
  return body;
}

export async function claimOrder(token: string, id: string): Promise<ClaimResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/orders/${encodeURIComponent(id)}/claim`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = (await parseBody(res)) as ClaimResponse & { error?: string };
  if (!res.ok && res.status !== 409) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : `HTTP ${res.status}`,
      res.status,
      body
    );
  }
  return body as ClaimResponse;
}

export async function patchOrderStatus(
  token: string,
  id: string,
  targetStatus: string
): Promise<PatchStatusResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/orders/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ targetStatus }),
  });
  const body = (await parseBody(res)) as PatchStatusResponse & { error?: string; message?: string };
  if (!res.ok) {
    throw new ApiError(
      typeof body.message === 'string'
        ? body.message
        : typeof body.error === 'string'
          ? body.error
          : `HTTP ${res.status}`,
      res.status,
      body
    );
  }
  return body;
}
