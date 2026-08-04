export type MinigameProps = {
  gameId: string;
  meUserId: string | null;
  myScore: number;
  onSubmitScore: () => void;
};

export async function submitMinigameScore(opts: {
  gameId: string;
  minigameId: string;
  raw: Record<string, number>;
}): Promise<{ challengeScore: number; improved: boolean }> {
  const res = await fetch(`/api/game/${opts.gameId}/casting/mini-game`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ minigameId: opts.minigameId, raw: opts.raw }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to submit");
  return {
    challengeScore: Number(json.challengeScore ?? 0),
    improved: !!json.improved,
  };
}
