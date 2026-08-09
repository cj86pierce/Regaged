export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollFrookiesPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="FROOKIES"
      title="Frookies"
      description="HOH + competition POV, save/renom, then votes. Jury (9th–3rd) picks the winner at final 2."
      buttonBg="linear-gradient(#f8bbd9, #f48fb1)"
      buttonColor="#5a2a3a"
      me={me}
    />
  );
}
