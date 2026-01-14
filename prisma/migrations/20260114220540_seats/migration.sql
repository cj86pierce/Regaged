/*
  Warnings:

  - A unique constraint covering the columns `[gameId,seatIndex]` on the table `GamePlayer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "seatIndex" INTEGER;

-- CreateIndex
CREATE INDEX "GamePlayer_gameId_seatIndex_idx" ON "GamePlayer"("gameId", "seatIndex");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_seatIndex_key" ON "GamePlayer"("gameId", "seatIndex");
