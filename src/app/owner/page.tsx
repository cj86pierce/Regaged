export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { resolveStaffFlags } from "@/lib/staffAccess";
import OwnerPanel from "./OwnerPanel";

export default async function OwnerPage() {
  const userId = await getCurrentUserIdFromHeaders();
  if (!userId) redirect("/login");

  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { isOwner: true, isAdmin: true, usernameLower: true },
  });
  const staff = me ? resolveStaffFlags(me) : null;
  if (!staff?.isStaff) {
    return (
      <main style={{ padding: 16 }}>
        <h1>Staff</h1>
        <p>You do not have access.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 16, maxWidth: 720 }}>
      <h1 style={{ marginTop: 0 }}>{staff.isOwner ? "Owner" : "Admin"} panel</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Lookalike-name alerts, support inbox, who’s online, and look up players to edit currencies, rename,
        warn, or ban.
      </p>
      <OwnerPanel />
    </main>
  );
}
