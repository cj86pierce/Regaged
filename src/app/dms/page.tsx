export const dynamic = "force-dynamic";

import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { redirect } from "next/navigation";
import DmsClient from "./DmsClient";

export default async function DmsPage() {
  const userId = await getCurrentUserIdFromHeaders();
  if (!userId) redirect("/login");

  return (
    <main style={{ padding: 12, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, color: "var(--brand)" }}>Messages</h1>
      <DmsClient />
    </main>
  );
}
