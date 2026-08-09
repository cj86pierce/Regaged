import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const colors = await p.colorLevel.findMany({
  select: { id: true, name: true, karmaNeeded: true },
  orderBy: { id: "asc" },
});
console.log("colors", colors);

const yellow = colors.find((c) => c.name === "Yellow");
console.log("yellowRow", yellow);

const owners = await p.userColor.findMany({
  where: { color: { name: "Yellow" } },
  select: {
    userId: true,
    colorId: true,
    user: { select: { username: true, equippedColorId: true, tMoney: true } },
  },
});
console.log(
  "yellowOwners",
  owners.map((o) => ({
    username: o.user.username,
    colorId: o.colorId,
    equippedColorId: o.user.equippedColorId,
    equippedIsYellow: yellow ? o.user.equippedColorId === yellow.id : null,
    tMoney: o.user.tMoney,
  }))
);

const equippedButMaybeNotOwned = await p.user.findMany({
  where: { equippedColorId: yellow?.id ?? -1 },
  select: { username: true, equippedColorId: true, tMoney: true },
});
console.log("equippedYellowUsers", equippedButMaybeNotOwned);

await p.$disconnect();
