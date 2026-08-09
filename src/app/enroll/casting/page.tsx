export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollCastingPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="CASTING"
      title="Castings"
      description="12-hour days. Health decays if you don’t show up. Apples heal, poison hurts, keys win at the end."
      buttonBg="linear-gradient(#eaf2ff, #d6e6ff)"
      me={me}
    />
  );
}
