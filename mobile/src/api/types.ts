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
  order: {
    id?: string;
    name?: string;
    moment?: string;
    sum?: number;
    state?: { name?: string };
    stateName?: string;
    customFields?: {
      deliveryType?: string | null;
      pickerNote?: string | null;
      shipmentNumber?: string | null;
    };
    [key: string]: unknown;
  };
};

export type ClaimResponse =
  | { claimed: true; already?: boolean; claimedAt?: string; moyskladOrderId?: string }
  | { claimed: false; takenBy?: { login: string; at: string } };

export type PatchStatusResponse = {
  ok: true;
  currentStatus: string | null;
  targetStatus: string;
  order: OrderDetailResponse['order'];
};

export type EscalationAckResponse = {
  ok: true;
  stopped: boolean;
};

export type EscalationsAckAllResponse = {
  ok: true;
  stoppedCount: number;
};
