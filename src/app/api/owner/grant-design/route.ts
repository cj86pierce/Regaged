import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/requireOwner";
import { parseDesignType } from "@/lib/designTypes";

/**
 * POST multipart: username, title, description?, designType, file (PNG)
 * Creates a design and grants DesignOwner to the target user (avatar inventory).
 * Skipped from community auction (has an owner immediately).
 */
export async function POST(req: Request) {
  const gate = await requireOwner(req);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const usernameRaw = (typeof form.get("username") === "string" ? (form.get("username") as string) : "").trim();
  const title = (typeof form.get("title") === "string" ? (form.get("title") as string) : "").trim();
  const description = (typeof form.get("description") === "string" ? (form.get("description") as string) : "").trim();
  const designType = parseDesignType(form.get("designType"));
  const file = form.get("file");

  if (!usernameRaw) return NextResponse.json({ error: "Username required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!designType) return NextResponse.json({ error: "Design type is required" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "PNG file is required" }, { status: 400 });
  if (file.type !== "image/png") return NextResponse.json({ error: "Only PNG uploads are allowed" }, { status: 400 });

  const maxBytes = 512 * 1024;
  const arrayBuffer = await file.arrayBuffer();
  if (arrayBuffer.byteLength > maxBytes) {
    return NextResponse.json({ error: "Image too large (max 512KB)" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { usernameLower: usernameRaw.toLowerCase() },
    select: { id: true, username: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const buffer = Buffer.from(arrayBuffer);

  const design = await prisma.$transaction(async (tx) => {
    const created = await tx.design.create({
      data: {
        userId: gate.ownerId,
        title,
        description: description || title,
        designType,
        image: buffer,
        contentType: file.type || "image/png",
      },
    });

    await tx.designOwner.create({
      data: { userId: target.id, designId: created.id },
    });

    return created;
  });

  return NextResponse.json({
    ok: true,
    designId: design.id,
    grantedTo: target.username,
    designType: design.designType,
    title: design.title,
  });
}
