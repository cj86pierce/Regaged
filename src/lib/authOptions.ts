import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { enforceLoginGuards } from "@/lib/authLoginGuards";

// Required for NextAuth (VPS: set in .env). Generate with: openssl rand -base64 32
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const usernameRaw = (credentials?.username ?? "").toString().trim();
        const password = (credentials?.password ?? "").toString();

        if (!usernameRaw || !password) return null;

        const usernameLower = usernameRaw.toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { usernameLower },
              { username: { equals: usernameRaw, mode: "insensitive" } },
            ],
          },
          select: {
            id: true,
            username: true,
            usernameLower: true,
            passwordHash: true,
            isOwner: true,
            lockedLoginIp: true,
            bannedAt: true,
          },
        });

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        const headers =
          req && typeof (req as { headers?: unknown }).headers === "object"
            ? ((req as { headers: Headers | Record<string, string | string[] | undefined> }).headers)
            : new Headers();
        const clientIp = getClientIpFromHeaders(headers);

        const guard = await enforceLoginGuards(
          {
            id: user.id,
            usernameLower: user.usernameLower,
            isOwner: user.isOwner,
            lockedLoginIp: user.lockedLoginIp,
            bannedAt: user.bannedAt,
          },
          clientIp
        );

        if (!guard.ok) {
          // NextAuth Credentials treats null as invalid credentials; throw for clearer client message
          throw new Error(guard.reason);
        }

        return { id: guard.userId, name: guard.username, isOwner: guard.isOwner };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        token.name = (user as { name?: string }).name;
        token.isOwner = Boolean((user as { isOwner?: boolean }).isOwner);
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) (session as { user: Record<string, unknown> }).user = {};

      const u = session.user as { id?: string; name?: string | null; isOwner?: boolean };
      u.id = token.id as string | undefined;
      u.name = token.name as string;
      u.isOwner = Boolean(token.isOwner);

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
