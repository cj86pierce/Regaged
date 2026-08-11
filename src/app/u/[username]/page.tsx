export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { prisma } from "@/lib/prisma";
import { touchUser } from "@/lib/touchUser";
import ProfileTabs from "@/components/ProfileTabs";
import { loadProfileTabsData } from "@/lib/loadProfileTabsData";
import Link from "next/link";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: { username: string };
  searchParams: { page?: string };
}) {
  const usernameLower = decodeURIComponent(params.username).toLowerCase();

  const user = await prisma.user.findUnique({
    where: { usernameLower },
    select: { id: true },
  });

  if (!user) {
    return (
      <main style={{ padding: 8 }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--bg-card)", padding: 14 }}>
          <h1 style={{ marginTop: 0 }}>Profile</h1>
          <p>User not found.</p>
          <Link href="/">Back to home</Link>
        </div>
      </main>
    );
  }

  const currentUserId = await getCurrentUserIdFromHeaders();
  if (currentUserId === user.id) {
    await touchUser(currentUserId);
  }

  const page = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const data = await loadProfileTabsData({
    userId: user.id,
    isOwnProfile: currentUserId === user.id,
    page,
    viewerId: currentUserId,
  });

  return <ProfileTabs data={data} />;
}
