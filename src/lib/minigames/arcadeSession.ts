import * as jose from "jose";

const ALG = "HS256";
const COOKIE = "regaged_arcade";
const COST_R = 5;
const TTL = "2h";

export const ARCADE_COST_R = COST_R;
export const ARCADE_COOKIE = COOKIE;

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET/NEXTAUTH_SECRET required for arcade sessions");
    }
    return new TextEncoder().encode("dev-arcade-secret-change-me!!".slice(0, 32));
  }
  return new TextEncoder().encode(s.length >= 32 ? s : s.padEnd(32, "0").slice(0, 32));
}

export type ArcadeSession = {
  userId: string;
  minigameId: string;
};

export async function signArcadeSession(payload: ArcadeSession): Promise<string> {
  return new jose.SignJWT({ ...payload, kind: "arcade" })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(getSecret());
}

export async function verifyArcadeSession(token: string): Promise<ArcadeSession | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    if (payload.kind !== "arcade") return null;
    const userId = payload.userId as string;
    const minigameId = payload.minigameId as string;
    if (!userId || !minigameId) return null;
    return { userId, minigameId };
  } catch {
    return null;
  }
}

export function arcadeCookieHeader(token: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${2 * 60 * 60}${secure}`;
}
