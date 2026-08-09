/**
 * Upsert staff Admin account.
 * Usage: ADMIN_PASSWORD='...' node scripts/create-admin.mjs
 * Optional: ADMIN_USERNAME=Admin
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const username = (process.env.ADMIN_USERNAME || "Admin").trim();
const password = process.env.ADMIN_PASSWORD || "";
if (!password || password.length < 8) {
  console.error("Set ADMIN_PASSWORD (min 8 chars)");
  process.exit(1);
}

const usernameLower = username.toLowerCase();
const passwordHash = await bcrypt.hash(password, 10);

const existing = await p.user.findUnique({
  where: { usernameLower },
  select: { id: true },
});

if (existing) {
  await p.user.update({
    where: { id: existing.id },
    data: {
      username,
      passwordHash,
      isAdmin: true,
      isOwner: false,
      emailVerifiedAt: new Date(),
      warnedAt: null,
      bannedAt: null,
      banReason: null,
    },
  });
  console.log(`updated ${username} (${existing.id}) isAdmin=true`);
} else {
  const created = await p.user.create({
    data: {
      username,
      usernameLower,
      passwordHash,
      isAdmin: true,
      isOwner: false,
      emailVerifiedAt: new Date(),
      karma: 0,
      tMoney: 0,
    },
    select: { id: true },
  });
  console.log(`created ${username} (${created.id}) isAdmin=true`);
}

await p.$disconnect();
