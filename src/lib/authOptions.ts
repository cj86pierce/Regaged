import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
        const username = (credentials?.username ?? "").toString().trim().toLowerCase();
        const password = (credentials?.password ?? "").toString();

        if (!username || !password) return null;

        const user = await prisma.user.findUnique({ where: { username } });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        // ✅ mark site-wide activity on login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        return { id: user.id, name: user.username };
      },
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) (token as any).uid = user.id;
      return token;
    },
    async session({ session, token }) {
      (session.user as any).id = (token as any).uid;
      return session;
    },
  },
};
