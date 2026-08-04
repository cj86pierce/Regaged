-- Survivor tribe-scoped chat
ALTER TABLE "GameMessage" ADD COLUMN IF NOT EXISTS "tribe" TEXT;
CREATE INDEX IF NOT EXISTS "GameMessage_gameId_tribe_createdAt_idx" ON "GameMessage"("gameId", "tribe", "createdAt");
