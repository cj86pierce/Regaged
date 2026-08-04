"use client";

import { type MinigameId } from "@/lib/minigamePicker";
import EmojiMatchingGame from "./EmojiMatchingGame";
import EmojiMatch3Game from "./EmojiMatch3Game";
import RhythmGame from "./RhythmGame";
import DealOrNoDealGame from "./DealOrNoDealGame";
import SimonGame from "./SimonGame";
import ReactionGame from "./ReactionGame";
import MathRushGame from "./MathRushGame";
import DodgeGame from "./DodgeGame";
import type { MinigameProps } from "./types";

export function renderMinigame(id: MinigameId, props: MinigameProps) {
  switch (id) {
    case "matching":
      return <EmojiMatchingGame {...props} />;
    case "match3":
      return <EmojiMatch3Game {...props} />;
    case "rhythm":
      return <RhythmGame {...props} />;
    case "deal":
      return <DealOrNoDealGame {...props} />;
    case "simon":
      return <SimonGame {...props} />;
    case "reaction":
      return <ReactionGame {...props} />;
    case "mathrush":
      return <MathRushGame {...props} />;
    case "dodge":
      return <DodgeGame {...props} />;
    default:
      return null;
  }
}
