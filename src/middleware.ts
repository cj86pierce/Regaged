import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Only lock down in production (Vercel live site)
  if (process.env.NODE_ENV === "production") {
    const path = req.nextUrl.pathname;

    // Block all dev/debug endpoints
    if (
      path.startsWith("/api/dev") ||
      path.startsWith("/api/envcheck") ||
      path.startsWith("/api/health")
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  return NextResponse.next();
}

// Apply only to these routes (keeps middleware lightweight)
export const config = {
  matcher: ["/api/dev/:path*", "/api/envcheck", "/api/health"],
};
