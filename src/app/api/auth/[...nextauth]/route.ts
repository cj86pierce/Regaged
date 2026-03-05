import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// NextAuth uses NEXTAUTH_SECRET (from authOptions) and NEXTAUTH_URL from .env
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
