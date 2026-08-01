import * as jose from "jose";

const ALG = "HS256";
const DEV_FALLBACK_SECRET = "dev-secret-change-in-production";

let secret: Uint8Array | null = null;

function getSecret(): Uint8Array {
  if (!secret) {
    const s = process.env.JWT_SECRET;
    if (!s) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "JWT_SECRET is not set. Refusing to sign/verify Steam auth tokens with an insecure default in production."
        );
      }
      // Local/dev convenience only — never reached in production (see above).
      secret = new TextEncoder().encode(DEV_FALLBACK_SECRET.padEnd(32, "0").slice(0, 32));
    } else {
      secret = new TextEncoder().encode(s.length >= 32 ? s : s.padEnd(32, "0").slice(0, 32));
    }
  }
  return secret;
}

export type JwtPayload = { userId: string };

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret());
    const userId = payload.userId as string;
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
