/**
 * Format last seen / online status:
 * 0-4 min: "online"
 * 5-60 min: "5 min", "6 min", ..., "60 min"
 * 1-24 hours: "1 hour", "2 hours", ..., "24 hours"
 * 1+ days: "1 day", "2 days", ... (keeps counting)
 */
export function formatLastSeen(lastSeenAtIso: string): string {
  const ms = Date.now() - new Date(lastSeenAtIso).getTime();
  const mins = Math.floor(ms / 60000);
  if (!Number.isFinite(mins) || mins < 0) return "offline";
  if (mins < 5) return "online";
  if (mins <= 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours <= 24) return hours === 1 ? "1 hour" : `${hours} hours`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}
