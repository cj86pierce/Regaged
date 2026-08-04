export type MinigameProps = {
  gameId: string;
  meUserId: string | null;
  myScore: number;
  onSubmitScore: (challengeScore?: number) => void;
  /** Defaults to casting; Survivor challenges use survivor endpoint. */
  scoreMode?: "casting" | "survivor" | "arcade";
};

export async function submitMinigameScore(opts: {
  gameId: string;
  minigameId: string;
  raw: Record<string, number>;
  mode?: "casting" | "survivor" | "arcade";
}): Promise<{ challengeScore: number; improved: boolean }> {
  const arcade = opts.gameId === "arcade" || opts.mode === "arcade";
  const url = arcade
    ? "/api/minigames/score"
    : `/api/game/${opts.gameId}/mini-game`;
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
