import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Bot_01..Bot_20 with password: bot123 (email verified)");

  const passwordHash = await bcrypt.hash("bot123", 10);

  for (let i = 1; i <= 20; i++) {
    const username = `Bot_${String(i).padStart(2, "0")}`;
    const usernameLower = username.toLowerCase();
    const email = `${usernameLower}@regaged.bot`;

    // ✅ use findFirst so we don't depend on unique username
    const existing = await prisma.user.findFirst({
      where: { OR: [{ usernameLower }, { email }] },
      select: { id: true },
    });

    if (existing) {
      console.log(`✔ ${username} already exists`);
      continue;
    }

    await prisma.user.create({
      data: {
        username,
        usernameLower,
        email,
        emailVerifiedAt: new Date(),
        passwordHash,
        karma: 0,
        tMoney: 0,
      },
    });

    console.log(`➕ Created ${username}`);
  }

  console.log("✅ Done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
