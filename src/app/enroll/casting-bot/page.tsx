export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollCastingBotPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="CASTING_BOT"
      title="Castings (Bot)"
      description="Short casting days for practice. Bots fill instantly. No payouts."
      buttonBg="linear-gradient(#eaf2ff, #d6e6ff)"
      me={me}
    />
  );
}
