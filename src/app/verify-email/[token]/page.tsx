export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function VerifyEmailTokenPage({ params }: { params: { token: string } }) {
  const token = (params.token ?? "").toString().trim();
  if (!token) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Verify Email</h1>
        <p>Invalid verification link.</p>
        <Link href="/profile">Back to profile</Link>
      </main>
    );
  }

  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
    select: { id: true, email: true },
  });

  if (!user) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Verify Email</h1>
        <p>Invalid or expired link.</p>
        <Link href="/profile/edit">Back to edit profile</Link>
      </main>
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
    },
  });

  return (
    <main style={{ padding: 12 }}>
      <h1 style={{ marginTop: 0 }}>Verify Email</h1>
      <p style={{ fontWeight: 900, color: "#198754" }}>
        ✅ Email verified{user.email ? `: ${user.email}` : ""}!
      </p>
      <Link href="/enroll">Go enroll</Link>
    </main>
  );
}
