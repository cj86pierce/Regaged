import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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
      async authorize(credentials) {
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
        });

        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return { id: user.id, name: user.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.name = (user as any).name;
      }
      return token;
    },
    async session({ session, token }) {
      // ✅ make TS happy + safe at runtime
      if (!session.user) session.user = {} as any;

      (session.user as any).id = token.id;
      (session.user as any).name = token.name as string;

      return session;
    },
  },
};
