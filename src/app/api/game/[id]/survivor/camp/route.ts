import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/getCurrentUserId";
import { campAction, syncCampTimers } from "@/lib/survivor/camp";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action as "eat" | "drink" | "gather" | undefined;
  if (action !== "eat" && action !== "drink" && action !== "gather") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await syncCampTimers(params.id);
  const result = await campAction({
    gameId: params.id,
    userId,
    action,
    amount: body?.amount,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, punished: "punished" in result ? result.punished : undefined },
      { status: result.error === "Not a Survivor game" ? 404 : 400 }
    );
  }

  return NextResponse.json(result);
}
