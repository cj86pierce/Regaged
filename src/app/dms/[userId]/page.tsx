export const dynamic = "force-dynamic";

import Link from "next/link";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import DmChatClient from "./DmChatClient";

export default async function DmChatPage({ params }: { params: { userId: string } }) {
  const meId = await getCurrentUserIdFromHeaders();
  if (!meId) redirect("/login");

  const other = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, username: true },
  });
  if (!other) notFound();

  return (
    <main style={{ padding: 12, maxWidth: 640, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/dms" style={{ fontSize: 12, color: "var(--link-color)", textDecoration: "underline" }}>
          ← Back to messages
        </Link>
      </div>
      <h2 style={{ marginTop: 0, color: "var(--brand)" }} className="theme-username">
        {other.username}
      </h2>
      <DmChatClient otherUserId={other.id} otherUsername={other.username} />
    </main>
  );
}
