/** Names that cannot be registered or renamed to. */
export const RESERVED_USERNAMES = ["siege", "admin"] as const;

/** Username aliases that always count as site owner (in addition to isOwner). */
export const OWNER_USERNAME_ALIASES = ["carson", "siege"] as const;

/** Username aliases that always count as site admin (in addition to isAdmin). */
export const ADMIN_USERNAME_ALIASES = ["admin"] as const;

/** Kept off the public Hall of Fame board. */
export const HOF_EXCLUDED_USERNAMES = ["carson", "siege", "admin"] as const;

export function normalizeUsername(name: string): string {
  return name.trim().toLowerCase();
}

export function isReservedUsername(name: string): boolean {
  return (RESERVED_USERNAMES as readonly string[]).includes(normalizeUsername(name));
}

export function isOwnerUsername(name: string): boolean {
  return (OWNER_USERNAME_ALIASES as readonly string[]).includes(normalizeUsername(name));
}

export function isAdminUsername(name: string): boolean {
  return (ADMIN_USERNAME_ALIASES as readonly string[]).includes(normalizeUsername(name));
}

/** Owner or admin — staff privileges / multi-account exempt. */
export function isStaffUsername(name: string): boolean {
  return isOwnerUsername(name) || isAdminUsername(name);
}

export function reservedUsernameError(): string {
  return "That username is reserved and cannot be used.";
}
