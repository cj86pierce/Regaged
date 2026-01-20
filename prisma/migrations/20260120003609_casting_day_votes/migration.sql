/*
  Warnings:

  - You are about to drop the column `evictedUserId` on the `CastingDayResult` table. All the data in the column will be lost.
  - You are about to drop the column `nomineeAUserId` on the `CastingDayResult` table. All the data in the column will be lost.
  - You are about to drop the column `nomineeBUserId` on the `CastingDayResult` table. All the data in the column will be lost.
  - You are about to drop the column `nomineeCUserId` on the `CastingDayResult` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[gameId,dayNumber,voterUserId,targetUserId]` on the table `CastingVote` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "CastingVote_gameId_dayNumber_voterUserId_key";

-- AlterTable
ALTER TABLE "CastingDayResult" DROP COLUMN "evictedUserId",
DROP COLUMN "nomineeAUserId",
DROP COLUMN "nomineeBUserId",
DROP COLUMN "nomineeCUserId",
ADD COLUMN     "evictedUserIds" TEXT[],
ADD COLUMN     "nomineeUserIds" TEXT[];

-- AlterTable
ALTER TABLE "GamePlayer" ALTER COLUMN "health" SET DEFAULT 70;

-- CreateIndex
CREATE UNIQUE INDEX "CastingVote_gameId_dayNumber_voterUserId_targetUserId_key" ON "CastingVote"("gameId", "dayNumber", "voterUserId", "targetUserId");
