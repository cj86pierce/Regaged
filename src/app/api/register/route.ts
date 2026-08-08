import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkBlockedContent } from "@/lib/contentFilter";
import { isReservedUsername, reservedUsernameError } from "@/lib/usernames";

function okJson(data: any) {
  return NextResponse.json(data);
}
function errJson(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function isValidUsername(u: string) {
  // no emojis, no spaces, no underscores for now
  return /^[A-Za-z0-9]{3,20}$/.test(u);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const usernameRaw = (body?.username ?? "").toString().trim();
  const password = (body?.password ?? "").toString();

  if (!isValidUsername(usernameRaw)) {
    return errJson("Username must be 3–20 characters (letters + numbers only).");
  }

  // ✅ filter username for slurs/graphic only (swearing list not included)
  const hit = checkBlockedContent(usernameRaw);
  if (hit) return errJson("Username contains blocked language.", 400);
  if (isReservedUsername(usernameRaw)) return errJson(reservedUsernameError(), 400);

  if (password.length < 6) return errJson("Password must be at least 6 characters.");

  const usernameLower = usernameRaw.toLowerCase();

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { usernameLower },
        { username: { equals: usernameRaw, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });

  if (existing) return errJson("Username already taken.", 409);

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username: usernameRaw,
        usernameLower,
        passwordHash,
      },
      select: { id: true, createdAt: true },
    });
    return okJson({ ok: true, userId: user.id, createdAt: user.createdAt.toISOString() });
  } catch (e) {
    console.error("Register: user.create failed", e);
    return errJson("Database error saving account. Try again or contact support.", 500);
  }
}
