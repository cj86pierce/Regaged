-- AlterEnum
ALTER TYPE "GameState" ADD VALUE 'JURY_VOTE';

-- CreateTable
CREATE TABLE "JuryVote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JuryVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JuryVote_gameId_idx" ON "JuryVote"("gameId");

-- CreateIndex
CREATE INDEX "JuryVote_gameId_targetUserId_idx" ON "JuryVote"("gameId", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "JuryVote_gameId_voterUserId_key" ON "JuryVote"("gameId", "voterUserId");

-- AddForeignKey
ALTER TABLE "JuryVote" ADD CONSTRAINT "JuryVote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
