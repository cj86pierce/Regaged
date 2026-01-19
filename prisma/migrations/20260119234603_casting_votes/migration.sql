-- CreateTable
CREATE TABLE "CastingDayResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "nomineeAUserId" TEXT NOT NULL,
    "nomineeBUserId" TEXT NOT NULL,
    "nomineeCUserId" TEXT NOT NULL,
    "evictedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CastingDayResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CastingVote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CastingVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CastingDayResult_gameId_dayNumber_idx" ON "CastingDayResult"("gameId", "dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CastingDayResult_gameId_dayNumber_key" ON "CastingDayResult"("gameId", "dayNumber");

-- CreateIndex
CREATE INDEX "CastingVote_gameId_dayNumber_idx" ON "CastingVote"("gameId", "dayNumber");

-- CreateIndex
CREATE INDEX "CastingVote_gameId_dayNumber_targetUserId_idx" ON "CastingVote"("gameId", "dayNumber", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "CastingVote_gameId_dayNumber_voterUserId_key" ON "CastingVote"("gameId", "dayNumber", "voterUserId");

-- AddForeignKey
ALTER TABLE "CastingDayResult" ADD CONSTRAINT "CastingDayResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CastingVote" ADD CONSTRAINT "CastingVote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
