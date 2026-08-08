/** Names that cannot be registered or renamed to. */
export const RESERVED_USERNAMES = ["siege"] as const;

/** Username aliases that always count as site owner / admin (in addition to isOwner). */
export const OWNER_USERNAME_ALIASES = ["carson", "siege"] as const;

/** Kept off the public Hall of Fame board. */
export const HOF_EXCLUDED_USERNAMES = ["carson", "siege"] as const;

export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

export function isReservedUsername(name: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(normalizeUsername(name));
}

export function isOwnerUsername(name: string): boolean {
  return (OWNER_USERNAME_ALIASES as readonly string[]).includes(normalizeUsername(name));
}

export function reservedUsernameError(): string {
  return "That username is reserved and cannot be used.";
}
