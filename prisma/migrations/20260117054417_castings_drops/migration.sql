-- CreateEnum
CREATE TYPE "CastingDropKind" AS ENUM ('APPLE', 'KEY');

-- CreateEnum
CREATE TYPE "CastingDropOptionKind" AS ENUM ('APPLE', 'KEY', 'POISON');

-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'CASTING';

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "castingDayStartedAt" TIMESTAMP(3),
ADD COLUMN     "castingLastAppleHourKey" TEXT,
ADD COLUMN     "castingLastKeyHourKey" TEXT;

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "health" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "keys" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CastingDropEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "kind" "CastingDropKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageId" TEXT NOT NULL,
    "claimedByUserId" TEXT,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "CastingDropEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CastingDropOption" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "kind" "CastingDropOptionKind" NOT NULL,

    CONSTRAINT "CastingDropOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CastingDropEvent_messageId_key" ON "CastingDropEvent"("messageId");

-- CreateIndex
CREATE INDEX "CastingDropEvent_gameId_dayNumber_createdAt_idx" ON "CastingDropEvent"("gameId", "dayNumber", "createdAt");

-- CreateIndex
CREATE INDEX "CastingDropEvent_gameId_claimedAt_idx" ON "CastingDropEvent"("gameId", "claimedAt");

-- CreateIndex
CREATE INDEX "CastingDropOption_eventId_idx" ON "CastingDropOption"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CastingDropOption_eventId_slotIndex_key" ON "CastingDropOption"("eventId", "slotIndex");

-- AddForeignKey
ALTER TABLE "CastingDropEvent" ADD CONSTRAINT "CastingDropEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingDropOption" ADD CONSTRAINT "CastingDropOption_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CastingDropEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
