/**
 * Create auctions from designs whose voting has ended.
 * Rule: The design with the highest votes goes to auction.
 * Even if all designs have 0 votes, the 1st place design (by score, then oldest) goes to auction.
 * Auction winner = highest bidder (handled by bid route).
 */
import { prisma } from "@/lib/prisma";

const DESIGN_VOTING_MS = 24 * 60 * 60 * 1000; // 24 hours
const AUCTION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function createAuctionsFromDesigns(): Promise<{ created: number }> {
  const now = new Date();

  const designs = await prisma.design.findMany({
    where: {
      createdAt: { lt: new Date(now.getTime() - DESIGN_VOTING_MS) },
    },
    include: { votes: true },
    orderBy: { createdAt: "asc" },
  });

  const alreadyAuctioned = new Set(
    (await prisma.auction.findMany({ select: { designId: true } })).map((a) => a.designId)
  );

  const eligible = designs.filter((d) => !alreadyAuctioned.has(d.id));

  const score = (d: { votes: { type: string; points: number }[] }) => {
    const plus = d.votes.filter((v) => v.type === "PLUS").reduce((s, v) => s + v.points, 0);
    const minus = d.votes.filter((v) => v.type === "MINUS").reduce((s, v) => s + v.points, 0);
    return plus - minus;
  };

  const byType = new Map<string, typeof eligible>();
  for (const d of eligible) {
    const t = d.designType;
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(d);
  }

  let created = 0;
  for (const [, list] of byType) {
    const sorted = [...list].sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sa !== sb) return sb - sa;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    const top = sorted[0];
    if (!top) continue;

    const startsAt = new Date();
    const endsAt = new Date(now.getTime() + AUCTION_DURATION_MS);

    await prisma.auction.create({
      data: { designId: top.id, startsAt, endsAt, currentBid: 5 },
    });
    created++;
    alreadyAuctioned.add(top.id);
  }

  return { created };
}
