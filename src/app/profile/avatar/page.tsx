export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import AvatarEditor from "./ui/AvatarEditor";

export default async function AvatarPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return <main style={{ padding: 12 }}>You must be logged in.</main>;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,

      bodyStyle: true,
      hairStyle: true,
      eyesStyle: true,
      mouthStyle: true,
      shirtStyle: true,
      accessoryStyle: true,

      bodyColor: true,
      hairColor: true,
      eyeColor: true,
      mouthColor: true,
      shirtColor: true,
      accessoryColor: true,
    },
  });

  return <AvatarEditor initial={user!} />;
}
