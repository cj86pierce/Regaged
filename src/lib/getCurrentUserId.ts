import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { verifyJwt } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

function parseRegagedTokenCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)regaged_token=([^;]+)/);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

async function rejectIfBanned(userId: string | undefined): Promise<string | undefined> {
  if (!userId) return undefined;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true },
  });
  if (!u || u.bannedAt) return undefined;
  return userId;
}

async function userIdFromNextAuth(req?: Request, cookieHeader?: string | null): Promise<string | undefined> {
  const cookie = cookieHeader ?? req?.headers.get("cookie") ?? null;
  if (!cookie && !req) return undefined;
  // NEXTAUTH_URL may be https (prod) while local cookies use the non-secure name.
  const secureCookie = cookie?.includes("__Secure-next-auth.session-token=")
    ? true
    : cookie?.includes("next-auth.session-token=")
      ? false
      : undefined;

  const token = await getToken({
    req: (req ?? { headers: { cookie: cookie ?? "" } }) as Parameters<typeof getToken>[0]["req"],
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });
  const id = (token?.id as string | undefined) ?? (token?.sub as string | undefined);
  return id || undefined;
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
    if (payload) return rejectIfBanned(payload.userId);
  }
  const cookieHeader = req.headers.get("cookie");
  const steamToken = parseRegagedTokenCookie(cookieHeader);
  if (steamToken) {
    const payload = await verifyJwt(steamToken);
    if (payload) return rejectIfBanned(payload.userId);
  }
  const fromJwt = await userIdFromNextAuth(req, cookieHeader);
  if (fromJwt) return rejectIfBanned(fromJwt);
  const session = await getServerSession(authOptions);
  return rejectIfBanned((session?.user as { id?: string } | undefined)?.id);
}

/**
 * For server components: get current user id from next/headers (cookie only).
 * Use when you don't have the Request (e.g. page.tsx).
 */
export async function getCurrentUserIdFromHeaders(): Promise<string | undefined> {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const steamToken = cookieStore.get("regaged_token")?.value;
  if (steamToken) {
    const payload = await verifyJwt(steamToken);
    if (payload) return rejectIfBanned(payload.userId);
  }
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const fromJwt = await userIdFromNextAuth(undefined, cookieHeader || null);
  if (fromJwt) return rejectIfBanned(fromJwt);
  const session = await getServerSession(authOptions);
  return rejectIfBanned((session?.user as { id?: string } | undefined)?.id);
}
