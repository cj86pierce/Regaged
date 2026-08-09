import { prisma } from "@/lib/prisma";
import { userOwnsYellowOrHigher } from "@/lib/colorAccess";

export type EnrollMe = {
  username: string;
  tMoney: number;
  ownsYellowOrHigher: boolean;
  highestColorName: string;
};

export async function loadEnrollMe(userId: string | null): Promise<EnrollMe | null> {
  if (!userId) return null;

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true, tMoney: true },
  });
  if (!me) return null;

  const highest = await prisma.userColor.findFirst({
    where: { userId },
    orderBy: { colorId: "desc" },
    select: { color: { select: { name: true } } },
  });

  return {
    username: me.username,
    tMoney: me.tMoney,
    ownsYellowOrHigher: await userOwnsYellowOrHigher(userId),
    highestColorName: highest?.color.name ?? "White",
  };
}
