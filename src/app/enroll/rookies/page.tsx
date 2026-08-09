export const dynamic = "force-dynamic";

import EnrollScreen from "@/components/EnrollScreen";
import { getCurrentUserIdFromHeaders } from "@/lib/getCurrentUserId";
import { loadEnrollMe } from "@/lib/loadEnrollMe";

export default async function EnrollRookiesPage() {
  const userId = await getCurrentUserIdFromHeaders();
  const me = await loadEnrollMe(userId);

  return (
    <EnrollScreen
      gameType="ROOKIES"
      title="Rookies"
      description="Week-style days, ranking votes, secret POV. Yellow + R$15 entry."
      buttonBg="linear-gradient(#f8bbd9, #f48fb1)"
      buttonColor="#5a2a3a"
      me={me}
    />
  );
}
