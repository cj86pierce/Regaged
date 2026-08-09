export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollFastingBotPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="FASTING_BOT"
      title="Fastings (Bot)"
      description="Same Fastings rules on short phases. Bots fill instantly. Practice — no payouts."
      buttonBg="linear-gradient(#ffd85a, #ffb703)"
      me={me}
    />
  );
}
