import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
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

        // ✅ migration-safe:
        // - prefer new normalized column
        // - fallback to case-insensitive username for old rows
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
      (session.user as any).id = token.id;
      session.user.name = token.name as string;
      return session;
    },
  },
};
