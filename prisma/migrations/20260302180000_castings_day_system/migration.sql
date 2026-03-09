-- AlterTable
ALTER TABLE "Game" ADD COLUMN "castingDayProcessedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN "castingDayMiniGameScore" INTEGER NOT NULL DEFAULT 0;
