export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollFastingPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="FASTING"
      title="Fastings"
      description="Quick game. POV first, then nominations, then eviction. Empty seats bot-fill after 15 minutes."
      buttonBg="linear-gradient(#ffd85a, #ffb703)"
      me={me}
    />
  );
}
