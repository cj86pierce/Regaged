/**
 * CASTING_BOT advancement - 2 min days (testing), self-contained.
 * Uses transactions only (no advisory locks).
 */
import { prisma } from "@/lib/prisma";
import { getSystemUserId } from "@/lib/systemUser";
import { performBotActions } from "@/lib/botActions";

const BOT_DAY_MS = 2 * 60 * 1000; // 2 min for testing

function evictCount(active: number) {
  if (active >= 6) return 2;
  if (active === 5) return 1;
  return 0;
}

function nomineeCount(ev: number) {
  return ev === 2 ? 4 : ev === 1 ? 3 : 0;
}

function netChecks(plus: number | null, minus: number | null) {
  return (plus ?? 0) - (minus ?? 0);
}

function pickNominees(
  rows: { userId: string; keys: number; plusCount: number | null; minusCount: number | null; health: number | null }[],
  count: number
) {
  const sorted = [...rows].sort((a, b) => {
    if (a.keys !== b.keys) return a.keys - b.keys;
    const ac = netChecks(a.plusCount, a.minusCount);
    const bc = netChecks(b.plusCount, b.minusCount);
    if (ac !== bc) return ac - bc;
    return (a.health ?? 70) - (b.health ?? 70);
  });
  return sorted.slice(0, count).map((x) => x.userId);
}

/**
 * forceDue: when true (manual nudge), treat as due despite timer.
 */
export async function catchUpCastingBotGame(gameId: string, options?: { forceDue?: boolean }) {
  const forceDue = options?.forceDue === true;
  const now = new Date();

  try {
    await performBotActions(gameId);
  } catch (e) {
    console.error("CASTING_BOT bot actions failed", { gameId, err: String(e) });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
    const game = await tx.game.findUnique({
      where: { id: gameId },
      select: { id: true, gameType: true, state: true, roundNumber: true, stateEndsAt: true },
    });
    if (!game || game.gameType !== "CASTING_BOT") return { ok: false, reason: "not_found" as const };
    if (game.state !== "ROUND_NOMINATE" && game.state !== "ROUND_VOTE") return { ok: false, reason: "wrong_state" as const };

    // ROUND_NOMINATE = start of new day; process without timer check (like CASTING).
    if (game.state === "ROUND_NOMINATE") {
      const dayNum = game.roundNumber ?? 1;
      const activeCount = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
      const ev2 = evictCount(activeCount);
      const nom2 = nomineeCount(ev2);
      const rows = await tx.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
      });
      const nominees2 = pickNominees(
        rows.map((r) => ({ ...r, keys: r.keys ?? 0 })),
        nom2
      );
      await tx.castingDayResult.upsert({
        where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
        update: { nomineeUserIds: nominees2, evictedUserIds: [] },
        create: { gameId, dayNumber: dayNum, nomineeUserIds: nominees2, evictedUserIds: [] },
      });
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "ROUND_VOTE",
          stateEndsAt: new Date(now.getTime() + BOT_DAY_MS),
        },
      });
      const sysId = await getSystemUserId();
      await tx.gameMessage.create({
        data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${dayNum} voting has begun.` },
      });
      return { ok: true, advanced: true as const };
    }

    if (!forceDue) {
      const endAt = game.stateEndsAt?.getTime() ?? 0;
      const grace = 5000;
      if (endAt > now.getTime() + grace) return { ok: false, reason: "not_due" as const };
    }

    const dayNum = game.roundNumber ?? 1;

    // Wiki Day 1: No nominees. Expel 1 by algorithm (worst keys, checks, health).
    if (dayNum === 1) {
      const rows = await tx.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
      });
      const ranked = rows
        .map((p) => ({
          userId: p.userId,
          keys: p.keys ?? 0,
          checks: netChecks(p.plusCount, p.minusCount),
          health: p.health ?? 70,
        }))
        .sort((a, b) => {
          if (a.keys !== b.keys) return a.keys - b.keys;
          if (a.checks !== b.checks) return a.checks - b.checks;
          return a.health - b.health;
        });
      const evicted = ranked[0]?.userId;
      if (!evicted) return { ok: false, reason: "no_players" as const };

      const activeCount = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
      const place = activeCount;

      await tx.gamePlayer.update({
        where: { gameId_userId: { gameId, userId: evicted } },
        data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: place },
      });
      await tx.castingDayResult.upsert({
        where: { gameId_dayNumber: { gameId, dayNumber: 1 } },
        update: { evictedUserIds: [evicted] },
        create: { gameId, dayNumber: 1, nomineeUserIds: [], evictedUserIds: [evicted] },
      });
      const sysId = await getSystemUserId();
      await tx.gameMessage.create({
        data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day 1 resolved. One contestant eliminated by algorithm.` },
      });

      const activeAfter = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
      if (activeAfter <= 4) {
        const actives = await tx.gamePlayer.findMany({
          where: { gameId, status: "ACTIVE" },
          select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
        });
        const finalRanked = [...actives].sort((a, b) => {
          const ah = a.health ?? 70, bh = b.health ?? 70;
          if (bh !== ah) return bh - ah;
          const ak = a.keys ?? 0, bk = b.keys ?? 0;
          if (bk !== ak) return bk - ak;
          const ac = netChecks(a.plusCount, a.minusCount), bc = netChecks(b.plusCount, b.minusCount);
          return bc - ac;
        });
        for (let i = 0; i < finalRanked.length; i++) {
          await tx.gamePlayer.update({
            where: { gameId_userId: { gameId, userId: finalRanked[i].userId } },
            data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: i + 1 },
          });
        }
        const users = await tx.user.findMany({
          where: { id: { in: finalRanked.map((r) => r.userId) } },
          select: { id: true, username: true },
        });
        const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;
        await tx.game.update({
          where: { id: gameId },
          data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
        });
        await tx.gameMessage.create({
          data: {
            gameId,
            userId: sysId,
            channel: "PUBLIC",
            body: `[SYSTEM] Castings finished!\n- 1st: ${nameOf(finalRanked[0]?.userId ?? "?")}\n- 2nd: ${nameOf(finalRanked[1]?.userId ?? "?")}\n- 3rd: ${nameOf(finalRanked[2]?.userId ?? "?")}\n- 4th: ${nameOf(finalRanked[3]?.userId ?? "?")}`,
          },
        });
        return { ok: true, advanced: true as const };
      }

      const rows2 = await tx.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
      });
      const ev2 = evictCount(rows2.length);
      const nom2 = nomineeCount(ev2);
      const nominees2 = pickNominees(rows2.map((r) => ({ ...r, keys: r.keys ?? 0 })), nom2);
      await tx.castingDayResult.upsert({
        where: { gameId_dayNumber: { gameId, dayNumber: 2 } },
        update: { nomineeUserIds: nominees2, evictedUserIds: [] },
        create: { gameId, dayNumber: 2, nomineeUserIds: nominees2, evictedUserIds: [] },
      });
      await tx.game.update({
        where: { id: gameId },
        data: { state: "ROUND_VOTE", roundNumber: 2, stateEndsAt: new Date(now.getTime() + BOT_DAY_MS) },
      });
      await tx.gameMessage.create({
        data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day 2 voting has begun.` },
      });
      return { ok: true, advanced: true as const };
    }

    const activeCount = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
    const ev = evictCount(activeCount);
    const nomCount = nomineeCount(ev);

    if (ev === 0) {
      const actives = await tx.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
      });
      const ranked = [...actives].sort((a, b) => {
        const ah = a.health ?? 70, bh = b.health ?? 70;
        if (bh !== ah) return bh - ah;
        const ak = a.keys ?? 0, bk = b.keys ?? 0;
        if (bk !== ak) return bk - ak;
        const ac = netChecks(a.plusCount, a.minusCount), bc = netChecks(b.plusCount, b.minusCount);
        return bc - ac;
      });
      for (let i = 0; i < ranked.length; i++) {
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: ranked[i].userId } },
          data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: i + 1 },
        });
      }
      const sysId = await getSystemUserId();
      const users = await tx.user.findMany({
        where: { id: { in: ranked.map((r) => r.userId) } },
        select: { id: true, username: true },
      });
      const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;
      await tx.game.update({
        where: { id: gameId },
        data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
      });
      await tx.gameMessage.create({
        data: {
          gameId,
          userId: sysId,
          channel: "PUBLIC",
          body: `[SYSTEM] Castings finished!\n- 1st: ${nameOf(ranked[0]?.userId ?? "?")}\n- 2nd: ${nameOf(ranked[1]?.userId ?? "?")}\n- 3rd: ${nameOf(ranked[2]?.userId ?? "?")}\n- 4th: ${nameOf(ranked[3]?.userId ?? "?")}`,
        },
      });
      return { ok: true, finalized: true as const };
    }

    if (game.state === "ROUND_VOTE") {
      const day = await tx.castingDayResult.findUnique({
        where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
        select: { nomineeUserIds: true, evictedUserIds: true },
      });

      if (!day?.nomineeUserIds?.length) {
        const rows = await tx.gamePlayer.findMany({
          where: { gameId, status: "ACTIVE" },
          select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
        });
        const nominees = pickNominees(
          rows.map((r) => ({ ...r, keys: r.keys ?? 0 })),
          nomCount
        );
        await tx.castingDayResult.upsert({
          where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
          update: { nomineeUserIds: nominees, evictedUserIds: [] },
          create: { gameId, dayNumber: dayNum, nomineeUserIds: nominees, evictedUserIds: [] },
        });
      }

      const day2 = await tx.castingDayResult.findUnique({
        where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
        select: { nomineeUserIds: true, evictedUserIds: true },
      });
      if (!day2?.nomineeUserIds?.length) return { ok: false, reason: "no_nominees" as const };
      if (day2.evictedUserIds && day2.evictedUserIds.length > 0) {
        const activeAfterResolved = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        if (activeAfterResolved <= 4) {
          const actives = await tx.gamePlayer.findMany({
            where: { gameId, status: "ACTIVE" },
            select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
          });
          const ranked = [...actives].sort((a, b) => {
            const ah = a.health ?? 70, bh = b.health ?? 70;
            if (bh !== ah) return bh - ah;
            const ak = a.keys ?? 0, bk = b.keys ?? 0;
            if (bk !== ak) return bk - ak;
            const ac = netChecks(a.plusCount, a.minusCount), bc = netChecks(b.plusCount, b.minusCount);
            return bc - ac;
          });
          for (let i = 0; i < ranked.length; i++) {
            await tx.gamePlayer.update({
              where: { gameId_userId: { gameId, userId: ranked[i].userId } },
              data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: i + 1 },
            });
          }
          const sysId3 = await getSystemUserId();
          const users = await tx.user.findMany({
            where: { id: { in: ranked.map((r) => r.userId) } },
            select: { id: true, username: true },
          });
          const nameOf3 = (id: string) => users.find((u) => u.id === id)?.username ?? id;
          await tx.game.update({
            where: { id: gameId },
            data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
          });
          await tx.gameMessage.create({
            data: {
              gameId,
              userId: sysId3,
              channel: "PUBLIC",
              body: `[SYSTEM] Castings finished!\n- 1st: ${nameOf3(ranked[0]?.userId ?? "?")}\n- 2nd: ${nameOf3(ranked[1]?.userId ?? "?")}\n- 3rd: ${nameOf3(ranked[2]?.userId ?? "?")}\n- 4th: ${nameOf3(ranked[3]?.userId ?? "?")}`,
            },
          });
          return { ok: true, advanced: true as const };
        }
        const nextDay = dayNum + 1;
        const ev2 = evictCount(activeAfterResolved);
        const nom2 = nomineeCount(ev2);
        const rows = await tx.gamePlayer.findMany({
          where: { gameId, status: "ACTIVE" },
          select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
        });
        const nominees2 = pickNominees(rows.map((r) => ({ ...r, keys: r.keys ?? 0 })), nom2);
        await tx.castingDayResult.upsert({
          where: { gameId_dayNumber: { gameId, dayNumber: nextDay } },
          update: { nomineeUserIds: nominees2, evictedUserIds: [] },
          create: { gameId, dayNumber: nextDay, nomineeUserIds: nominees2, evictedUserIds: [] },
        });
        const sysId4 = await getSystemUserId();
        await tx.game.update({
          where: { id: gameId },
          data: { state: "ROUND_VOTE", roundNumber: nextDay, stateEndsAt: new Date(now.getTime() + BOT_DAY_MS) },
        });
        await tx.gameMessage.create({
          data: { gameId, userId: sysId4, channel: "PUBLIC", body: `[SYSTEM] Day ${nextDay} voting has begun.` },
        });
        return { ok: true, advanced: true as const, day: nextDay };
      }

      const votes = await tx.castingVote.findMany({
        where: { gameId, dayNumber: dayNum },
        select: { targetUserId: true, points: true },
      });
      const totals = new Map<string, number>();
      for (const n of day2.nomineeUserIds) totals.set(n, 0);
      for (const v of votes) {
        if (totals.has(v.targetUserId)) totals.set(v.targetUserId, (totals.get(v.targetUserId)! + (v.points ?? 0)));
      }
      const ranked = day2.nomineeUserIds
        .map((id) => ({ id, pts: totals.get(id) ?? 0 }))
        .sort((a, b) => b.pts - a.pts);

      let evicted: string[];
      if (ranked.every((r) => r.pts === 0)) {
        const nomineeRows = await tx.gamePlayer.findMany({
          where: { gameId, userId: { in: day2.nomineeUserIds } },
          select: { userId: true, plusCount: true, minusCount: true, health: true },
        });
        evicted = nomineeRows
          .map((p) => ({ id: p.userId, checks: netChecks(p.plusCount, p.minusCount), health: p.health ?? 70 }))
          .sort((a, b) => a.checks - b.checks || a.health - b.health)
          .slice(0, ev)
          .map((x) => x.id);
      } else {
        evicted = ranked.slice(0, ev).map((x) => x.id);
      }

      for (const u of evicted) {
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: u } },
          data: { status: "ELIMINATED", eliminatedAt: now },
        });
        const remaining = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
        await tx.gamePlayer.update({
          where: { gameId_userId: { gameId, userId: u } },
          data: { eliminatedPlace: remaining + 1 },
        });
      }
      await tx.castingDayResult.update({
        where: { gameId_dayNumber: { gameId, dayNumber: dayNum } },
        data: { evictedUserIds: evicted },
      });

      const sysId = await getSystemUserId();
      await tx.gameMessage.create({
        data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${dayNum} resolved.` },
      });

      const activeAfter = await tx.gamePlayer.count({ where: { gameId, status: "ACTIVE" } });
      if (activeAfter <= 4) {
        const actives = await tx.gamePlayer.findMany({
          where: { gameId, status: "ACTIVE" },
          select: { userId: true, health: true, keys: true, plusCount: true, minusCount: true },
        });
        const ranked = [...actives].sort((a, b) => {
          const ah = a.health ?? 70, bh = b.health ?? 70;
          if (bh !== ah) return bh - ah;
          const ak = a.keys ?? 0, bk = b.keys ?? 0;
          if (bk !== ak) return bk - ak;
          const ac = netChecks(a.plusCount, a.minusCount), bc = netChecks(b.plusCount, b.minusCount);
          return bc - ac;
        });
        for (let i = 0; i < ranked.length; i++) {
          await tx.gamePlayer.update({
            where: { gameId_userId: { gameId, userId: ranked[i].userId } },
            data: { status: "ELIMINATED", eliminatedAt: now, eliminatedPlace: i + 1 },
          });
        }
        const sysId2 = await getSystemUserId();
        const users = await tx.user.findMany({
          where: { id: { in: ranked.map((r) => r.userId) } },
          select: { id: true, username: true },
        });
        const nameOf = (id: string) => users.find((u) => u.id === id)?.username ?? id;
        await tx.game.update({
          where: { id: gameId },
          data: { state: "COMPLETED", completedAt: now, stateEndsAt: null },
        });
        await tx.gameMessage.create({
          data: {
            gameId,
            userId: sysId2,
            channel: "PUBLIC",
            body: `[SYSTEM] Castings finished!\n- 1st: ${nameOf(ranked[0]?.userId ?? "?")}\n- 2nd: ${nameOf(ranked[1]?.userId ?? "?")}\n- 3rd: ${nameOf(ranked[2]?.userId ?? "?")}\n- 4th: ${nameOf(ranked[3]?.userId ?? "?")}`,
          },
        });
        return { ok: true, advanced: true as const, day: dayNum };
      }

      const nextDay = dayNum + 1;
      const ev2 = evictCount(activeAfter);
      const nom2 = nomineeCount(ev2);
      const rows = await tx.gamePlayer.findMany({
        where: { gameId, status: "ACTIVE" },
        select: { userId: true, keys: true, plusCount: true, minusCount: true, health: true },
      });
      const nominees2 = pickNominees(
        rows.map((r) => ({ ...r, keys: r.keys ?? 0 })),
        nom2
      );
      await tx.castingDayResult.upsert({
        where: { gameId_dayNumber: { gameId, dayNumber: nextDay } },
        update: { nomineeUserIds: nominees2, evictedUserIds: [] },
        create: { gameId, dayNumber: nextDay, nomineeUserIds: nominees2, evictedUserIds: [] },
      });
      await tx.game.update({
        where: { id: gameId },
        data: {
          state: "ROUND_VOTE",
          roundNumber: nextDay,
          stateEndsAt: new Date(now.getTime() + BOT_DAY_MS),
        },
      });
      await tx.gameMessage.create({
        data: { gameId, userId: sysId, channel: "PUBLIC", body: `[SYSTEM] Day ${nextDay} voting has begun.` },
      });
      return { ok: true, advanced: true as const, day: nextDay };
    }

    return { ok: false, reason: "unknown" as const };
  });

  return result;
}
