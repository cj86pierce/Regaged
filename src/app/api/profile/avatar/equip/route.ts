import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";

const SLOTS = ["BODY", "HAIR", "EYES", "MOUTH", "SHIRT", "ACCESSORY", "BACKGROUND", "SCAR", "HAIR_ORNAMENT", "GLASSES"] as const;
const SLOT_FIELDS: Record<(typeof SLOTS)[number], string> = {
  BODY: "equippedBodyDesignId",
  HAIR: "equippedHairDesignId",
  EYES: "equippedEyesDesignId",
  MOUTH: "equippedMouthDesignId",
  SHIRT: "equippedShirtDesignId",
  ACCESSORY: "equippedAccessoryDesignId",
  BACKGROUND: "equippedBackgroundDesignId",
  SCAR: "equippedScarDesignId",
  HAIR_ORNAMENT: "equippedHairOrnamentDesignId",
  GLASSES: "equippedGlassesDesignId",
};

/** POST /api/profile/avatar/equip - equip or unequip a design. Body: { designId: string | null, slot: DesignType } */
export async function POST(req: Request) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.slot !== "string") {
    return NextResponse.json({ error: "Invalid body: slot required" }, { status: 400 });
  }
  const slot = body.slot as string;
  if (!SLOTS.includes(slot as any)) {
    return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
  }

  const designId = body.designId === null || body.designId === undefined ? null : String(body.designId);

  try {
    if (designId) {
      const owned = await prisma.designOwner.findUnique({
        where: { userId_designId: { userId, designId } },
        include: { design: true },
      });
      if (!owned) return NextResponse.json({ error: "You do not own this design" }, { status: 403 });
      if (owned.design.designType !== slot) {
        return NextResponse.json({ error: `Design is ${owned.design.designType}, not ${slot}` }, { status: 400 });
      }
    }

    const field = SLOT_FIELDS[slot as (typeof SLOTS)[number]];
    await prisma.user.update({
      where: { id: userId },
      data: { [field]: designId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Equip not available" }, { status: 503 });
  }
}
