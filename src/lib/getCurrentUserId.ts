import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { verifyJwt } from "@/lib/jwt";

function parseRegagedTokenCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)regaged_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

/**
 * Resolves the current user id for API routes.
 * Supports:
 * 1. Steam client: Authorization: Bearer <jwt>
 * 2. Steam callback: regaged_token cookie (JWT)
 * 3. Legacy site: NextAuth session cookie
 */
export async function getCurrentUserId(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (bearer) {
    const payload = await verifyJwt(bearer);
    if (payload) return payload.userId;
  }
  const token = parseRegagedTokenCookie(req.headers.get("cookie"));
  if (token) {
    const payload = await verifyJwt(token);
    if (payload) return payload.userId;
  }
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id;
}

/**
 * For server components: get current user id from next/headers (cookie only).
 * Use when you don't have the Request (e.g. page.tsx).
 */
export async function getCurrentUserIdFromHeaders(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const token = cookieStore.get("regaged_token")?.value;
  if (token) {
    const payload = await verifyJwt(token);
    if (payload) return payload.userId;
  }
  const session = await getServerSession(authOptions);
  return (session?.user as { id?: string } | undefined)?.id;
}
