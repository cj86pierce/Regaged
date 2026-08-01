/** Active enrollments first, then by joinedAt newest → oldest. */
export function sortProfileGames<
  T extends { state: string; yourStatus: string; joinedAt: string }
>(games: T[]): T[] {
  return [...games].sort((a, b) => {
    const aActive = a.state !== "COMPLETED" && a.yourStatus === "ACTIVE" ? 0 : 1;
    const bActive = b.state !== "COMPLETED" && b.yourStatus === "ACTIVE" ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
  });
}
