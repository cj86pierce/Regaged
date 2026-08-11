import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const names = ["megan", "bigsloth"];
const users = await p.user.findMany({
  where: { usernameLower: { in: names } },
  select: {
    id: true,
    username: true,
    isAdmin: true,
    isOwner: true,
    warnedAt: true,
    bannedAt: true,
  },
});
console.log("before:", JSON.stringify(users, null, 2));
const result = await p.user.updateMany({
  where: { usernameLower: { in: names }, isOwner: false },
  data: {
    isAdmin: true,
    warnedAt: null,
    bannedAt: null,
    banReason: null,
  },
});
console.log("updated:", result.count);
const after = await p.user.findMany({
  where: { usernameLower: { in: names } },
  select: { username: true, isAdmin: true, isOwner: true },
});
console.log("after:", JSON.stringify(after, null, 2));
await p.$disconnect();
