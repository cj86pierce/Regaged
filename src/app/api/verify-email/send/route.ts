import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import crypto from "crypto";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const token = crypto.randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { email: session.user.email },
    data: {
      emailVerifyToken: token,
      emailVerifySentAt: new Date(),
    },
  });

  const link = `${process.env.NEXTAUTH_URL}/verify-email/${token}`;

  // TEMP: console log (replace with real email later)
  console.log("VERIFY EMAIL:", link);

  return NextResponse.json({ ok: true });
}
