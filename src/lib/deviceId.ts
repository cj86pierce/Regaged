import { randomBytes } from "crypto";

export const DEVICE_COOKIE = "regaged_did";
const DEVICE_MAX_AGE_SEC = 60 * 60 * 24 * 400; // ~13 months

export function newDeviceId(): string {
  return randomBytes(16).toString("hex");
}

export function parseDeviceIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${DEVICE_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  const raw = decodeURIComponent(match[1]).trim();
  if (!/^[a-f0-9]{16,64}$/i.test(raw)) return null;
  return raw.toLowerCase();
}

export function parseDeviceIdFromHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | null | undefined
): string | null {
  if (!headers) return null;
  let cookie: string | null = null;
  if (typeof (headers as Headers).get === "function") {
    cookie = (headers as Headers).get("cookie");
  } else {
    const h = headers as Record<string, string | string[] | undefined>;
    const v = h.cookie ?? h.Cookie;
    cookie = Array.isArray(v) ? v.join("; ") : v ?? null;
  }
  return parseDeviceIdFromCookieHeader(cookie);
}

/** Set-Cookie value for a stable device id (readable by JS so login pages can mint it). */
export function deviceIdSetCookie(deviceId: string): string {
  return `${DEVICE_COOKIE}=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${DEVICE_MAX_AGE_SEC}; SameSite=Lax`;
}
