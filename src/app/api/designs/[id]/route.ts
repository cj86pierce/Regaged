import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { getDesign } from "@/lib/getDesign";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await getCurrentUserId(req);
  const design = await getDesign(params.id, userId ?? null);
  if (!design) return NextResponse.json({ error: "Design not found" }, { status: 404 });
  return NextResponse.json(design);
}
