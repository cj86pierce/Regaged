/** Auto-equip highest owned color for anyone who owns Yellow+ but has nothing / White equipped. */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const yellow = await p.colorLevel.findUnique({ where: { name: "Yellow" }, select: { id: true } });
if (!yellow) {
  console.log("no yellow");
  process.exit(1);
}

const owners = await p.userColor.findMany({
  where: { colorId: { gte: yellow.id } },
  select: { userId: true, colorId: true, user: { select: { username: true, equippedColorId: true } } },
});

const byUser = new Map();
for (const o of owners) {
  const cur = byUser.get(o.userId) ?? { username: o.user.username, equipped: o.user.equippedColorId, max: 0 };
  cur.max = Math.max(cur.max, o.colorId);
  byUser.set(o.userId, cur);
}

let fixed = 0;
for (const [userId, info] of byUser) {
  const eq = info.equipped ?? 0;
  if (eq >= yellow.id) {
    console.log(`ok ${info.username} equipped=${eq}`);
    continue;
  }
  await p.user.update({
    where: { id: userId },
    data: { equippedColorId: info.max },
  });
  console.log(`fixed ${info.username}: equipped ${eq} → ${info.max}`);
  fixed++;
}

console.log(`done, fixed ${fixed}`);
await p.$disconnect();
