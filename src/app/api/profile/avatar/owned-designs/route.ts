import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/profile/avatar/owned-designs - list designs the user owns (from won auctions). */
export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const ownerships = await prisma.designOwner.findMany({
      where: { userId },
      include: { design: { select: { id: true, title: true, designType: true } } },
    });
    const designs = ownerships.map((o) => ({
      id: o.design.id,
      title: o.design.title,
      designType: o.design.designType,
    }));
    return NextResponse.json({ designs });
  } catch {
    return NextResponse.json({ designs: [] });
  }
}
