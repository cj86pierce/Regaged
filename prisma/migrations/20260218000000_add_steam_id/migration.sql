-- AlterTable
ALTER TABLE "User" ADD COLUMN "steamId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_steamId_key" ON "User"("steamId");
