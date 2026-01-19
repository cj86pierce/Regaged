-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "castingHealthGainedToday" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "castingLastDecayAt" TIMESTAMP(3);
