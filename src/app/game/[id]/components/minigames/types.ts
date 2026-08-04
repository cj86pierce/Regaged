export type MinigameProps = {
  gameId: string;
  meUserId: string | null;
  myScore: number;
  onSubmitScore: (challengeScore?: number) => void;
};

export async function submitMinigameScore(opts: {
  gameId: string;
  minigameId: string;
  raw: Record<string, number>;
}): Promise<{ challengeScore: number; improved: boolean }> {
  const arcade = opts.gameId === "arcade";
  const url = arcade
    ? "/api/minigames/score"
    : `/api/game/${opts.gameId}/casting/mini-game`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ minigameId: opts.minigameId, raw: opts.raw }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to submit");
  return {
    challengeScore: Number(json.challengeScore ?? 0),
    improved: !!json.improved,
  };
}
