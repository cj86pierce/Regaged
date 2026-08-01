import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";

/**
 * Verifies a caller is allowed to trigger a cron/tick endpoint.
 *
 * Fails closed: CRON_SECRET must be configured, and the caller must present
 * it (as `Authorization: Bearer <secret>` or `?secret=<secret>`). We do NOT
 * trust the `x-vercel-cron` header — this project is not hosted on Vercel,
 * and the header is trivially spoofable by any client.
 *
 * When `allowLoggedInUser` is set, an authenticated site user is also
 * accepted (used by /api/cron/tick so the client-side CronPinger safety net
 * keeps working without requiring a secret to be configured).
 */
export async function requireCronAuth(
  req: Request,
  opts?: { allowLoggedInUser?: boolean }
): Promise<NextResponse | null> {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const url = new URL(req.url);
    if (auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret) {
      return null;
    }
  }

  if (opts?.allowLoggedInUser) {
    const userId = await getCurrentUserId(req);
    if (userId) return null;
  }

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 503 }
    );
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
