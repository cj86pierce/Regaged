import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { isEmailVerified } from "@/lib/emailVerification";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!(await isEmailVerified(userId))) {
    return NextResponse.json(
      { error: "Email verification required", redirect: "/profile/edit" },
      { status: 403 }
    );
  }

  const warned = await prisma.user.findUnique({
    where: { id: userId },
    select: { warnedAt: true },
  });
  if (warned?.warnedAt) {
    return NextResponse.json(
      { error: "Your account is warned. You cannot buy from the shop until an owner clears the warning." },
      { status: 403 }
    );
  }

  const { id } = params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.regagedShopItem.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          designId: true,
          priceT: true,
          stock: true,
          active: true,
        },
      });
      if (!item || !item.active) throw new Error("Item not available");
      if (item.stock <= 0) throw new Error("Sold out");

      const alreadyPurchase = await tx.regagedShopPurchase.findUnique({
        where: { userId_itemId: { userId, itemId: item.id } },
        select: { id: true },
      });
      if (alreadyPurchase) throw new Error("Already owned");

      const alreadyOwner = await tx.designOwner.findUnique({
        where: { userId_designId: { userId, designId: item.designId } },
        select: { id: true },
      });
      if (alreadyOwner) throw new Error("Already owned");

      const me = await tx.user.findUnique({
        where: { id: userId },
        select: { tMoney: true },
      });
      if (!me) throw new Error("User not found");
      if (me.tMoney < item.priceT) throw new Error("Not enough R$");

      const updated = await tx.regagedShopItem.updateMany({
        where: { id: item.id, stock: { gt: 0 }, active: true },
        data: { stock: { decrement: 1 } },
      });
      if (updated.count !== 1) throw new Error("Sold out");

      await tx.user.update({
        where: { id: userId },
        data: { tMoney: { decrement: item.priceT } },
      });

      await tx.designOwner.create({
        data: { userId, designId: item.designId },
      });

      await tx.regagedShopPurchase.create({
        data: { userId, itemId: item.id, pricePaid: item.priceT },
      });

      const balance = await tx.user.findUnique({
        where: { id: userId },
        select: { tMoney: true },
      });

      return {
        title: item.title,
        designId: item.designId,
        priceT: item.priceT,
        tMoney: balance?.tMoney ?? me.tMoney - item.priceT,
        stock: item.stock - 1,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Purchase failed";
    const status =
      msg === "Item not available" || msg === "Sold out"
        ? 409
        : msg === "Already owned" || msg === "Not enough R$"
          ? 400
          : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
