import { PrismaClient } from "@prisma/client";
import { ensureColorLevels } from "../src/lib/ensureColorLevels";

const prisma = new PrismaClient();

async function main() {
  await ensureColorLevels();
  console.log("✅ 20 color levels seeded (TV Star last)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
