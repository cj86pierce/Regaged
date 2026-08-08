/** @deprecated Import from `@/lib/lobbyTiming` instead. */
export {
  BOT_FILL_WAIT_MS,
  LOBBY_WAIT_MS,
  botFillAtFromCreated,
  lobbyReadyAtFromCreated,
  isBotGameType,
  isLiveGameType,
  botLobbyCap,
  lobbyCap,
  maybeFillAndStartBotLobby,
  maybeStartLiveLobby,
  maybeStartEnrollingLobby,
} from "@/lib/lobbyTiming";
export type { BotGameType, LiveGameType } from "@/lib/lobbyTiming";
