-- AlterTable
ALTER TABLE "Game" ADD COLUMN "hohUserId" TEXT;

-- AlterTable
ALTER TABLE "RoundResult" ADD COLUMN "nomineeCUserId" TEXT,
ADD COLUMN "povSavedUserId" TEXT;

-- CreateTable
CREATE TABLE "RankingVote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankingVote_gameId_roundNumber_voterUserId_targetUserId_key" ON "RankingVote"("gameId", "roundNumber", "voterUserId", "targetUserId");

-- CreateIndex
CREATE INDEX "RankingVote_gameId_roundNumber_idx" ON "RankingVote"("gameId", "roundNumber");

-- AddForeignKey
ALTER TABLE "RankingVote" ADD CONSTRAINT "RankingVote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
