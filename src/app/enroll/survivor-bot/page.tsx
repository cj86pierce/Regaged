export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollSurvivorBotPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="SURVIVOR_BOT"
      title="Survivor (Bot)"
      description="Survivor practice with bots. Short phases, no payouts."
      buttonBg="linear-gradient(#a5d6a7, #66bb6a)"
      buttonColor="#1b3d1f"
      me={me}
    />
  );
}
