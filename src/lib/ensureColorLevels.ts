import { prisma } from "./prisma";
import { COLOR_CATALOG, TV_STAR_ID } from "./colorCatalog";

export { COLOR_CATALOG, TV_STAR_ID };

/** Upsert the 20-color ladder. Anyone who already owned TV Star keeps it at the new top. */
export async function ensureColorLevels() {
  const namedTv = await prisma.colorLevel.findMany({
    where: { name: "TV Star" },
    select: { id: true },
  });
  const oldTvIds = namedTv.map((r) => r.id).filter((id) => id !== TV_STAR_ID);
  const holderIds = oldTvIds.length
    ? [
        ...new Set(
          (
            await prisma.userColor.findMany({
              where: { colorId: { in: oldTvIds } },
              select: { userId: true },
            })
          ).map((h) => h.userId)
        ),
      ]
    : [];

  const existing = await prisma.colorLevel.findMany({ select: { id: true, name: true } });
  for (const row of existing) {
    const target = COLOR_CATALOG.find((c) => c.id === row.id);
    const desiredName = target?.name ?? `__retired_${row.id}`;
    if (row.name !== desiredName) {
      await prisma.colorLevel.update({
        where: { id: row.id },
        data: { name: `__tmp_${row.id}` },
      });
    }
  }

  for (const c of COLOR_CATALOG) {
    await prisma.colorLevel.upsert({
      where: { id: c.id },
      update: {
        name: c.name,
        karmaNeeded: c.karmaNeeded,
        priceT: c.priceT,
        strength: c.strength,
        isAnimated: c.isAnimated,
      },
      create: c,
    });
  }

  for (const row of existing.filter((r) => r.id > TV_STAR_ID)) {
    await prisma.colorLevel.update({
      where: { id: row.id },
      data: {
        name: `__retired_${row.id}`,
        karmaNeeded: 0,
        priceT: 0,
        strength: 1,
        isAnimated: false,
      },
    });
  }

  for (const userId of holderIds) {
    const have = await prisma.userColor.findMany({
      where: { userId },
      select: { colorId: true },
    });
    const haveIds = new Set(have.map((h) => h.colorId));
    for (let id = 14; id <= TV_STAR_ID; id++) {
      if (haveIds.has(id)) continue;
      await prisma.userColor.create({ data: { userId, colorId: id } }).catch(() => {});
    }
    await prisma.user.updateMany({
      where: { id: userId, equippedColorId: { in: oldTvIds } },
      data: { equippedColorId: TV_STAR_ID },
    });
  }
}
