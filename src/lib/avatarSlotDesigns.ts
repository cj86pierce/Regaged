import { prisma } from "@/lib/prisma";
import type { SlotDesignType } from "@/components/Avatar";

export type SlotDesignsMap = Partial<Record<SlotDesignType, string>>;

/**
 * Fetches equipped design slot URLs for a user. Returns {} if the DB doesn't
 * have the equipped design columns (e.g. migration not run in production).
 */
export async function getSlotDesignsForUser(userId: string): Promise<SlotDesignsMap> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        equippedShirtDesignId: true,
        equippedHairDesignId: true,
        equippedBodyDesignId: true,
        equippedEyesDesignId: true,
        equippedMouthDesignId: true,
        equippedAccessoryDesignId: true,
        equippedBackgroundDesignId: true,
        equippedScarDesignId: true,
        equippedHairOrnamentDesignId: true,
        equippedGlassesDesignId: true,
      },
    });
    if (!u) return {};
    const s: SlotDesignsMap = {};
    const eq = (id: string | null) => (id ? `/api/designs/${id}/image` : undefined);
    if (u.equippedShirtDesignId) s.SHIRT = eq(u.equippedShirtDesignId)!;
    if (u.equippedHairDesignId) s.HAIR = eq(u.equippedHairDesignId)!;
    if (u.equippedBodyDesignId) s.BODY = eq(u.equippedBodyDesignId)!;
    if (u.equippedEyesDesignId) s.EYES = eq(u.equippedEyesDesignId)!;
    if (u.equippedMouthDesignId) s.MOUTH = eq(u.equippedMouthDesignId)!;
    if (u.equippedAccessoryDesignId) s.ACCESSORY = eq(u.equippedAccessoryDesignId)!;
    if (u.equippedBackgroundDesignId) s.BACKGROUND = eq(u.equippedBackgroundDesignId)!;
    if (u.equippedScarDesignId) s.SCAR = eq(u.equippedScarDesignId)!;
    if (u.equippedHairOrnamentDesignId) s.HAIR_ORNAMENT = eq(u.equippedHairOrnamentDesignId)!;
    if (u.equippedGlassesDesignId) s.GLASSES = eq(u.equippedGlassesDesignId)!;
    return s;
  } catch {
    return {};
  }
}

/**
 * Fetches equipped slot designs for multiple users. Returns a map of userId -> SlotDesignsMap.
 * Safe when equipped columns don't exist.
 */
export async function getSlotDesignsForUserIds(
  userIds: string[]
): Promise<Record<string, SlotDesignsMap>> {
  if (userIds.length === 0) return {};
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        equippedShirtDesignId: true,
        equippedHairDesignId: true,
        equippedBodyDesignId: true,
        equippedEyesDesignId: true,
        equippedMouthDesignId: true,
        equippedAccessoryDesignId: true,
        equippedBackgroundDesignId: true,
        equippedScarDesignId: true,
        equippedHairOrnamentDesignId: true,
        equippedGlassesDesignId: true,
      },
    });
    const eq = (id: string | null) => (id ? `/api/designs/${id}/image` : undefined);
    const out: Record<string, SlotDesignsMap> = {};
    for (const u of users) {
      const s: SlotDesignsMap = {};
      if (u.equippedShirtDesignId) s.SHIRT = eq(u.equippedShirtDesignId)!;
      if (u.equippedHairDesignId) s.HAIR = eq(u.equippedHairDesignId)!;
      if (u.equippedBodyDesignId) s.BODY = eq(u.equippedBodyDesignId)!;
      if (u.equippedEyesDesignId) s.EYES = eq(u.equippedEyesDesignId)!;
      if (u.equippedMouthDesignId) s.MOUTH = eq(u.equippedMouthDesignId)!;
      if (u.equippedAccessoryDesignId) s.ACCESSORY = eq(u.equippedAccessoryDesignId)!;
      if (u.equippedBackgroundDesignId) s.BACKGROUND = eq(u.equippedBackgroundDesignId)!;
      if (u.equippedScarDesignId) s.SCAR = eq(u.equippedScarDesignId)!;
      if (u.equippedHairOrnamentDesignId) s.HAIR_ORNAMENT = eq(u.equippedHairOrnamentDesignId)!;
      if (u.equippedGlassesDesignId) s.GLASSES = eq(u.equippedGlassesDesignId)!;
      out[u.id] = s;
    }
    return out;
  } catch {
    return {};
  }
}
