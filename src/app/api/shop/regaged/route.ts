import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { requireOwner } from "@/lib/requireOwner";
import { parseDesignType } from "@/lib/designTypes";

function serializeItem(
  item: {
    id: string;
    title: string;
    description: string;
    designType: string;
    designId: string;
    priceT: number;
    stock: number;
    active: boolean;
    sortOrder: number;
    createdAt: Date;
  },
  opts?: { owned?: boolean }
) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    designType: item.designType,
    designId: item.designId,
    priceT: item.priceT,
    stock: item.stock,
    active: item.active,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    owned: !!opts?.owned,
  };
}

/** GET — list shop items (players see active only; owner sees all). */
export async function GET(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { isOwner: true, usernameLower: true, tMoney: true },
  });
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isOwnerUsername } = await import("@/lib/usernames");
  const isOwner = me.isOwner || isOwnerUsername(me.usernameLower);

  const items = await prisma.regagedShopItem.findMany({
    where: isOwner ? undefined : { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const ownedIds = new Set(
    (
      await prisma.regagedShopPurchase.findMany({
        where: { userId, itemId: { in: items.map((i) => i.id) } },
        select: { itemId: true },
      })
    ).map((p) => p.itemId)
  );

  return NextResponse.json({
    items: items.map((i) => serializeItem(i, { owned: ownedIds.has(i.id) })),
    tMoney: me.tMoney,
    isOwner,
  });
}

/** POST — owner create listing (multipart: file, title, description, designType, priceT, stock, sortOrder?). */
export async function POST(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  const title = (typeof form.get("title") === "string" ? (form.get("title") as string) : "").trim();
  const description = (typeof form.get("description") === "string" ? (form.get("description") as string) : "").trim();
  const designType = parseDesignType(form.get("designType"));
  const priceT = Number(form.get("priceT"));
  const stock = Number(form.get("stock"));
  const sortOrderRaw = form.get("sortOrder");
  const sortOrder = sortOrderRaw === null || sortOrderRaw === "" ? 0 : Number(sortOrderRaw);

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!designType) {
    return NextResponse.json({ error: "Design type is required" }, { status: 400 });
  }
  if (!Number.isFinite(priceT) || priceT < 0 || !Number.isInteger(priceT)) {
    return NextResponse.json({ error: "priceT must be a non-negative integer" }, { status: 400 });
  }
  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
    return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
  }
  if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder)) {
    return NextResponse.json({ error: "sortOrder must be an integer" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PNG file is required" }, { status: 400 });
  }
  if (file.type !== "image/png") {
    return NextResponse.json({ error: "Only PNG uploads are allowed" }, { status: 400 });
  }

  const maxBytes = 512 * 1024;
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    return NextResponse.json({ error: "Image too large (max 512KB)" }, { status: 400 });
  }

  const buffer = Buffer.from(arrayBuffer);

  const item = await prisma.$transaction(async (tx) => {
    const design = await tx.design.create({
      data: {
        userId: gate.ownerId,
        title,
        description: description || title,
        designType,
        image: buffer,
        contentType: file.type || "image/png",
      },
    });

    return tx.regagedShopItem.create({
      data: {
        title,
        description,
        designType,
        designId: design.id,
        priceT,
        stock,
        sortOrder,
        active: true,
      },
    });
  });

  return NextResponse.json({ ok: true, item: serializeItem(item) });
}
