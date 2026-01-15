export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EditProfileClient from "./ui/EditProfileClient";

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Edit Profile</h1>
        <p>You must be logged in.</p>
        <Link href="/login">Login</Link>
      </main>
    );
  }

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { bio: true, phoneVerifiedAt: true, phoneE164: true },
  });

  if (!me) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Edit Profile</h1>
        <p>User not found.</p>
      </main>
    );
  }

  return (
    <EditProfileClient
      initialBio={me.bio ?? ""}
      phoneVerifiedAt={me.phoneVerifiedAt ? me.phoneVerifiedAt.toISOString() : null}
      phoneE164={me.phoneE164 ?? null}
    />
  );
}
