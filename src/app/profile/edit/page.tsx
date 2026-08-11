export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EditProfileClient from "./ui/EditProfileClient";
import { avatarConfigFromUser } from "@/lib/avatarConfigFromUser";
import { getSlotDesignsForUser } from "@/lib/avatarSlotDesigns";

export default async function EditProfilePage() {
  const userId = await getCurrentUserIdFromHeaders();

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
    select: {
      bio: true,
      email: true,
      emailVerifiedAt: true,
      username: true,
      usernameChangedAt: true,
      bodyStyle: true,
      hairStyle: true,
      eyesStyle: true,
      mouthStyle: true,
      shirtStyle: true,
      accessoryStyle: true,
      glassesStyle: true,
      scarStyle: true,
      hairOrnamentStyle: true,
      bodyColor: true,
      hairColor: true,
      eyeColor: true,
      mouthColor: true,
      shirtColor: true,
      accessoryColor: true,
      backgroundColor: true,
      glassesColor: true,
      scarColor: true,
      hairOrnamentColor: true,
    },
  });

  if (!me) {
    return (
      <main style={{ padding: 12 }}>
        <h1 style={{ marginTop: 0 }}>Edit Profile</h1>
        <p>User not found.</p>
      </main>
    );
  }

  const slotDesigns = await getSlotDesignsForUser(userId);
  const avatar = avatarConfigFromUser(me);

  const colorPurchases = await prisma.userColor.findMany({
    where: { userId },
    include: { color: { select: { name: true } } },
    orderBy: { purchasedAt: "asc" },
  });
  const colorHistory = colorPurchases.map((p) => ({
    name: p.color.name,
    purchasedAt: p.purchasedAt.toISOString(),
  }));

  return (
    <EditProfileClient
      initialBio={me.bio ?? ""}
      email={me.email ?? ""}
      emailVerifiedAt={me.emailVerifiedAt ? me.emailVerifiedAt.toISOString() : null}
      username={me.username}
      usernameChangedAt={me.usernameChangedAt ? me.usernameChangedAt.toISOString() : null}
      avatar={avatar}
      slotDesigns={slotDesigns}
      colorHistory={colorHistory}
    />
  );
}
