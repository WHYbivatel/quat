import type { MembershipRole } from "@prisma/client";

export type Action =
  | "project:read"
  | "project:write"
  | "estimate:read"
  | "estimate:write"
  | "estimate:issue"
  | "export:client"
  | "export:internal"
  | "request:create"
  | "request:respond"
  | "offer:manage"
  | "admin:moderate"
  | "admin:import"
  | "org:manage";

const ROLE_ACTIONS: Record<MembershipRole, Action[]> = {
  owner: [
    "project:read",
    "project:write",
    "estimate:read",
    "estimate:write",
    "estimate:issue",
    "export:client",
    "export:internal",
    "request:create",
    "request:respond",
    "offer:manage",
    "admin:import",
    "org:manage",
  ],
  admin: [
    "project:read",
    "project:write",
    "estimate:read",
    "estimate:write",
    "estimate:issue",
    "export:client",
    "export:internal",
    "request:create",
    "request:respond",
    "offer:manage",
    "admin:import",
    "org:manage",
  ],
  estimator: [
    "project:read",
    "project:write",
    "estimate:read",
    "estimate:write",
    "estimate:issue",
    "export:client",
    "export:internal",
    "request:create",
  ],
  buyer: [
    "project:read",
    "project:write",
    "estimate:read",
    "estimate:write",
    "export:client",
    "request:create",
  ],
  supplier_manager: [
    "request:respond",
    "offer:manage",
    "admin:import",
    "project:read",
  ],
  viewer: ["project:read", "estimate:read", "export:client"],
  platform_admin: [
    "project:read",
    "project:write",
    "estimate:read",
    "estimate:write",
    "estimate:issue",
    "export:client",
    "export:internal",
    "request:create",
    "request:respond",
    "offer:manage",
    "admin:moderate",
    "admin:import",
    "org:manage",
  ],
};

export function can(role: MembershipRole, action: Action): boolean {
  return ROLE_ACTIONS[role]?.includes(action) ?? false;
}

export class AccessDeniedError extends Error {
  constructor(message = "Access denied") {
    super(message);
    this.name = "AccessDeniedError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}
