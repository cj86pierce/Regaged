import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";

/** PATCH — owner update title/description/price/stock/active/sortOrder. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.regagedShopItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const data: {
    title?: string;
    description?: string;
    priceT?: number;
    stock?: number;
    active?: boolean;
    sortOrder?: number;
  } = {};

  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
    data.title = title;
  }
  if ("description" in body) {
    data.description = typeof body.description === "string" ? body.description.trim() : "";
  }
  if ("priceT" in body) {
    const priceT = Number(body.priceT);
    if (!Number.isFinite(priceT) || priceT < 0 || !Number.isInteger(priceT)) {
      return NextResponse.json({ error: "priceT must be a non-negative integer" }, { status: 400 });
    }
    data.priceT = priceT;
  }
  if ("stock" in body) {
    const stock = Number(body.stock);
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
      return NextResponse.json({ error: "stock must be a non-negative integer" }, { status: 400 });
    }
    data.stock = stock;
  }
  if ("active" in body) {
    data.active = Boolean(body.active);
  }
  if ("sortOrder" in body) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder)) {
      return NextResponse.json({ error: "sortOrder must be an integer" }, { status: 400 });
    }
    data.sortOrder = sortOrder;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.regagedShopItem.update({ where: { id }, data });
    if (data.title || data.description !== undefined) {
      await tx.design.update({
        where: { id: item.designId },
        data: {
          ...(data.title ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description || data.title || item.title } : {}),
        },
      });
    }
    return item;
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      designType: updated.designType,
      designId: updated.designId,
      priceT: updated.priceT,
      stock: updated.stock,
      active: updated.active,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

/** DELETE — soft-deactivate (active=false). */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { id } = params;
  const existing = await prisma.regagedShopItem.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const updated = await prisma.regagedShopItem.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({
    ok: true,
    item: {
      id: updated.id,
      active: updated.active,
    },
  });
}
