/** Best-effort client IP behind nginx / proxy. */
export function getClientIpFromHeaders(headers: Headers | Record<string, string | string[] | undefined>): string | null {
  const get = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    const v = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0] ?? null;
    return typeof v === "string" ? v : null;
  };

  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return null;
}

export function normalizeIp(ip: string): string {
  const t = ip.trim();
  // Strip IPv6-mapped IPv4
  if (t.startsWith("::ffff:")) return t.slice(7);
  return t;
}

export function ipsMatch(a: string, b: string): boolean {
  return normalizeIp(a) === normalizeIp(b);
}
