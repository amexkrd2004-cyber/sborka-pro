export type LoginResponse = {
  token: string;
  expiresIn?: string;
  user?: {
    id: string;
    login: string;
    displayName?: string;
    role?: string;
  };
};

export type OrderSummary = {
  id: string;
  name: string;
  moment?: string;
  sum?: number;
  stateName?: string | null;
  href?: string | null;
};

export type OrdersListResponse = {
  orders: OrderSummary[];
};

export type OrderDetailResponse = {
  order: Record<string, unknown>;
};

export type ClaimResponse =
  | { claimed: true; already?: boolean; claimedAt?: string; moyskladOrderId?: string }
  | { claimed: false; takenBy?: { login: string; at: string } };
