import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEVICE_COOKIE = "regaged_did";
const DEVICE_MAX_AGE = 60 * 60 * 24 * 400;

function mintDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isValidDeviceId(v: string | undefined): boolean {
  return !!v && /^[a-f0-9]{16,64}$/i.test(v);
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Only lock down in production
  if (process.env.NODE_ENV === "production") {
    // Block dev/debug endpoints (envcheck allowed for DB diagnostic)
    if (path.startsWith("/api/dev") || path.startsWith("/api/health")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  const res = NextResponse.next();
  const existing = req.cookies.get(DEVICE_COOKIE)?.value;
  if (!isValidDeviceId(existing)) {
    res.cookies.set(DEVICE_COOKIE, mintDeviceId(), {
      path: "/",
      maxAge: DEVICE_MAX_AGE,
      sameSite: "lax",
    });
  }

  const ref = req.nextUrl.searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{3,24}$/.test(ref)) {
    res.cookies.set("rg_ref", ref.toLowerCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: [
    "/api/dev/:path*",
    "/api/health",
    "/login",
    "/register",
    "/",
    "/api/auth/:path*",
  ],
};
