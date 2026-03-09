-- Add drop type and care package support
-- 1. Add dropType to distinguish NORMAL vs CARE_PACKAGE
CREATE TYPE "CastingDropType" AS ENUM ('NORMAL', 'CARE_PACKAGE');

ALTER TABLE "CastingDropEvent" ADD COLUMN "dropType" "CastingDropType" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "CastingDropEvent" ADD COLUMN "recipientUserId" TEXT;

-- 2. Make messageId optional (care packages have no chat message)
ALTER TABLE "CastingDropEvent" ALTER COLUMN "messageId" DROP NOT NULL;

-- 3. Add lastCarePackageAtChecks for care package trigger (every 3000 checks)
ALTER TABLE "GamePlayer" ADD COLUMN "lastCarePackageAtChecks" INTEGER NOT NULL DEFAULT 0;

-- Index for fetching care packages by recipient
CREATE INDEX "CastingDropEvent_gameId_recipientUserId_claimedAt_idx" ON "CastingDropEvent"("gameId", "recipientUserId", "claimedAt");
