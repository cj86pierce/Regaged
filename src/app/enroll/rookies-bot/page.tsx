export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollRookiesBotPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="ROOKIES_BOT"
      title="Rookies (Bot)"
      description="Rookies practice on short phases. Bots fill instantly. No payouts."
      buttonBg="linear-gradient(#f8bbd9, #f48fb1)"
      buttonColor="#5a2a3a"
      me={me}
    />
  );
}
