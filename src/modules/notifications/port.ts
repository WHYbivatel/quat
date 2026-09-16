export type NotificationPayload = {
  type: "procurement_request_submitted" | "procurement_response_received";
  requestId: string;
  toOrganizationId: string;
  subject: string;
  body: string;
};

export interface NotificationPort {
  send(payload: NotificationPayload): Promise<{ ok: boolean; error?: string }>;
}

/** Default MVP adapter — logs only, never sends real email/SMS. */
export class LogNotificationAdapter implements NotificationPort {
  async send(payload: NotificationPayload) {
    console.info("[notification:log]", JSON.stringify(payload));
    return { ok: true };
  }
}

let adapter: NotificationPort = new LogNotificationAdapter();

export function getNotificationAdapter(): NotificationPort {
  return adapter;
}

/** Test helper */
export function setNotificationAdapter(next: NotificationPort) {
  adapter = next;
}
