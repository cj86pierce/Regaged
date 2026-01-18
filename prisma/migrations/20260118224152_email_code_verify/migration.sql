/*
  Warnings:

  - You are about to drop the column `emailVerifyToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerifyToken",
ADD COLUMN     "emailVerifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailVerifyCodeHash" TEXT,
ADD COLUMN     "emailVerifyExpiresAt" TIMESTAMP(3);
