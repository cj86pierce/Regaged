/*
  Warnings:

  - A unique constraint covering the columns `[usernameLower]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_username_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "usernameLower" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_usernameLower_key" ON "User"("usernameLower");

-- CreateIndex
CREATE INDEX "User_usernameLower_idx" ON "User"("usernameLower");
