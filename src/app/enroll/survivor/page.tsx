export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollSurvivorPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="SURVIVOR"
      title="Survivor"
      description="20 castaways, 2 tribes of 10. Tribe challenges, immunity, tribal council. Make merge for 1st or go home 20th."
      buttonBg="linear-gradient(#a5d6a7, #66bb6a)"
      buttonColor="#1b3d1f"
      me={me}
    />
  );
}
