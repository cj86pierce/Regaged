import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/jwt";
import bcrypt from "bcryptjs";
import { getClientIpFromHeaders } from "@/lib/clientIp";
import { enforceLoginGuards } from "@/lib/authLoginGuards";

const STEAM_WEB_API_KEY = process.env.STEAM_WEB_API_KEY;
const STEAM_APP_ID = process.env.STEAM_APP_ID || "480"; // Spacewar for dev; replace with your App ID

/**
 * POST /api/auth/steam
 * Body: { ticket: string } — hex-encoded auth session ticket from Steamworks
 * Returns: { token: string } (JWT) or error.
 * Used by the Steam desktop client; creates or finds user by steamId.
 */
export async function POST(req: Request) {
  if (!STEAM_WEB_API_KEY) {
    return NextResponse.json(
      { error: "Steam auth not configured (STEAM_WEB_API_KEY)" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const ticket = typeof body?.ticket === "string" ? body.ticket.trim() : "";
  if (!ticket) {
    return NextResponse.json({ error: "Missing ticket" }, { status: 400 });
  }

  const appId = Number(STEAM_APP_ID) || 480;
  const url = new URL("https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/");
  url.searchParams.set("key", STEAM_WEB_API_KEY);
  url.searchParams.set("appid", String(appId));
  url.searchParams.set("ticket", ticket);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    return NextResponse.json({ error: "Steam API unreachable" }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  const result = data?.response?.params;
  const steamId = result?.steamid;
  const resultCode = result?.result;

  // Steam returns "OK" on success
  if (resultCode !== "OK" || !steamId) {
    return NextResponse.json(
      { error: "Invalid or expired Steam ticket", result: resultCode },
      { status: 401 }
    );
  }

  const steamIdStr = String(steamId);

  let user = await prisma.user.findUnique({
    where: { steamId: steamIdStr },
    select: {
      id: true,
      username: true,
      usernameLower: true,
      isOwner: true,
      lockedLoginIp: true,
      bannedAt: true,
    },
  });

  if (!user) {
    // Optional: fetch Steam display name
    let displayName = `Steam_${steamIdStr.slice(-8)}`;
    try {
      const sumUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(STEAM_WEB_API_KEY)}&steamids=${steamIdStr}`;
      const sumRes = await fetch(sumUrl);
      const sumData = await sumRes.json();
      const player = sumData?.response?.players?.[0];
      if (player?.personaname) {
        const raw = String(player.personaname).trim().slice(0, 20);
        if (raw.length >= 2) displayName = raw.replace(/[^A-Za-z0-9]/g, "_");
      }
    } catch {
      /* ignore */
    }

    const { isReservedUsername } = await import("@/lib/usernames");
    let safeDisplay = displayName;
    if (isReservedUsername(safeDisplay)) safeDisplay = `user_${steamIdStr.slice(-6)}`;
    const usernameLower = safeDisplay.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { usernameLower },
      select: { id: true },
    });
    const username = existing ? `${safeDisplay}_${steamIdStr.slice(-6)}` : safeDisplay;
    const finalLower = username.toLowerCase();

    const passwordHash = await bcrypt.hash(`steam:${steamIdStr}:${Date.now()}`, 10);
    user = await prisma.user.create({
      data: {
        username: username,
        usernameLower: finalLower,
        passwordHash,
        steamId: steamIdStr,
        emailVerifiedAt: new Date(), // Steam users skip email verification
      },
      select: {
        id: true,
        username: true,
        usernameLower: true,
        isOwner: true,
        lockedLoginIp: true,
        bannedAt: true,
      },
    });
  }

  const clientIp = getClientIpFromHeaders(req.headers);
  const guard = await enforceLoginGuards(
    {
      id: user.id,
      usernameLower: user.usernameLower,
      isOwner: user.isOwner,
      lockedLoginIp: user.lockedLoginIp,
      bannedAt: user.bannedAt,
    },
    clientIp
  );
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: 403 });
  }

  const token = await signJwt({ userId: guard.userId });
  return NextResponse.json({ token, userId: guard.userId, username: guard.username });
}
