import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const colors = [
    { id: 0, name: "White", karmaNeeded: 0, priceT: 0, strength: 1, isAnimated: false },
    { id: 1, name: "Yellow", karmaNeeded: 15, priceT: 30, strength: 2, isAnimated: false },
    { id: 2, name: "Orange", karmaNeeded: 30, priceT: 40, strength: 3, isAnimated: false },
    { id: 3, name: "Light Green", karmaNeeded: 60, priceT: 50, strength: 4, isAnimated: false },
    { id: 4, name: "Green", karmaNeeded: 90, priceT: 80, strength: 5, isAnimated: false },
    { id: 5, name: "Blue", karmaNeeded: 120, priceT: 90, strength: 6, isAnimated: false },
    { id: 6, name: "Purple", karmaNeeded: 180, priceT: 100, strength: 7, isAnimated: false },
    { id: 7, name: "Red", karmaNeeded: 200, priceT: 120, strength: 8, isAnimated: false },
    { id: 8, name: "Brown", karmaNeeded: 240, priceT: 140, strength: 9, isAnimated: false },
    { id: 9, name: "Black", karmaNeeded: 350, priceT: 200, strength: 10, isAnimated: false },
    { id: 10, name: "Silver", karmaNeeded: 600, priceT: 300, strength: 11, isAnimated: true },
    { id: 11, name: "Gold", karmaNeeded: 1000, priceT: 400, strength: 12, isAnimated: true },
    { id: 12, name: "Sky", karmaNeeded: 1300, priceT: 500, strength: 13, isAnimated: true },
    { id: 13, name: "Blood", karmaNeeded: 1500, priceT: 600, strength: 14, isAnimated: true },
    { id: 14, name: "TV Star", karmaNeeded: 2000, priceT: 1000, strength: 15, isAnimated: true },
  ];

  for (const c of colors) {
    await prisma.colorLevel.upsert({
      where: { id: c.id },
      update: c,
      create: c,
    });
  }

  console.log("✅ Color levels seeded");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
