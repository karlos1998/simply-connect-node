export type UUID = string;
export type IsoDateTime = string;
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageChannel = "SMS" | "MMS";

export interface SmsEndpoint {
  id: UUID;
  name: string;
  phoneNumber?: string | null;
  enabled: boolean;
}

export interface SendSmsRequest {
  endpointId?: UUID;
  to: string;
  body: string;
}

export interface SmsSendResult {
  messageId: UUID;
  dispatchId: UUID;
  commandId: UUID;
  status: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface MutationOptions extends RequestOptions {
  idempotencyKey?: string;
}

export interface MessageQuery {
  query?: string;
  direction?: MessageDirection;
  status?: string;
  endpointId?: UUID;
  occurredFrom?: IsoDateTime | Date;
  occurredTo?: IsoDateTime | Date;
  page?: number;
  size?: number;
}

export interface ExternalEndpoint {
  id: UUID;
  name: string;
  phoneNumber?: string | null;
  enabled: boolean;
}

export interface Message {
  id: UUID;
  conversationId: UUID;
  direction: MessageDirection;
  channel: MessageChannel;
  body: string;
  remoteAddress: string;
  occurredAt: IsoDateTime;
  status?: string | null;
  endpoint: ExternalEndpoint;
}

export interface StatusEvent {
  status?: string | null;
  eventType?: string | null;
  source?: string | null;
  errorCode?: string | null;
  occurredAt?: IsoDateTime | null;
  recordedAt?: IsoDateTime | null;
}

export interface MessageDetails extends Message {
  createdAt: IsoDateTime;
  statusHistory: StatusEvent[];
}

export interface MessagePage {
  items: Message[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface CallQueueEndpoint {
  id: UUID;
  name: string;
  phoneNumber?: string | null;
  gatewayId: UUID;
  gatewayName: string;
  gatewayStatus: string;
}

export interface PublishedCallFlow {
  id: UUID;
  name: string;
  description?: string | null;
  publishedVersionId: UUID;
  updatedAt: IsoDateTime;
}

export interface CreateCallQueueEntryRequest {
  endpointId: UUID;
  destination: string;
  flowVersionId: UUID;
  requestId?: UUID;
  timeZone: string;
  scheduledFor?: IsoDateTime;
  intervalSeconds?: number;
}

export interface CallQueueItem {
  id: UUID;
  endpointId: UUID;
  destination: string;
  flowVersionId: UUID;
  flowName: string;
  flowVersion: number;
  source: string;
  status: string;
  reason?: string | null;
  callId?: UUID | null;
  notBefore: IsoDateTime;
  timeZone: string;
  intervalSeconds: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CallQueueQuery {
  endpointId?: UUID;
  status?: string;
  source?: "MANUAL" | "AUTOMATION" | "EXTERNAL_API" | string;
  search?: string;
  from?: IsoDateTime | Date;
  to?: IsoDateTime | Date;
  page?: number;
  size?: number;
  sort?: "notBefore" | "createdAt" | "destination" | "status";
  descending?: boolean;
}

export interface CallQueuePage {
  items: CallQueueItem[];
  page: number;
  totalElements: number;
  totalPages: number;
}

export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  properties?: Record<string, unknown>;
  code?: string;
  [key: string]: unknown;
}

export interface SimplyConnectClientOptions {
  apiKey: string;
  baseUrl?: string;
  defaultSmsEndpointId?: UUID;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
}
