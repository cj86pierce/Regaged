export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollFrookiesBotPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="FROOKIES_BOT"
      title="Frookies (Bot)"
      description="Same Frookies rules on ~2 minute phases. Bots fill instantly. Practice — no payouts."
      buttonBg="linear-gradient(#f8bbd9, #f48fb1)"
      buttonColor="#5a2a3a"
      me={me}
    />
  );
}
