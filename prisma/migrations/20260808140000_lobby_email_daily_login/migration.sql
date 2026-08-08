-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "loginStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "longestLoginStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastLoginRewardDate" TEXT;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "startEmailSentAt" TIMESTAMP(3);
