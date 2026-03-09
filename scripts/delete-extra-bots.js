#!/usr/bin/env node
/**
 * Delete bot users not in the Bot_01..Bot_40 pool.
 * Run from project root: node scripts/delete-extra-bots.js
 * Requires DATABASE_URL in .env
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const KEEP = new Set(
  Array.from({ length: 40 }, (_, i) => `bot_${String(i + 1).padStart(2, "0")}`)
);

async function main() {
  const bots = await prisma.user.findMany({
    where: { usernameLower: { startsWith: "bot_" } },
    select: { id: true, username: true, usernameLower: true },
  });
  const toDelete = bots.filter((u) => !KEEP.has(u.usernameLower));
  if (toDelete.length === 0) {
    console.log("No extra bots to delete.");
    return;
  }
  console.log(`Deleting ${toDelete.length} extra bots: ${toDelete.map((u) => u.username).join(", ")}`);
  for (const u of toDelete) {
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`  Deleted ${u.username}`);
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
