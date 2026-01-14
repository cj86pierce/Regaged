-- CreateTable
CREATE TABLE "GamePmMessage" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamePmMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GamePmMessage_gameId_createdAt_idx" ON "GamePmMessage"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "GamePmMessage_gameId_senderUserId_recipientUserId_createdAt_idx" ON "GamePmMessage"("gameId", "senderUserId", "recipientUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "GamePmMessage" ADD CONSTRAINT "GamePmMessage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePmMessage" ADD CONSTRAINT "GamePmMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePmMessage" ADD CONSTRAINT "GamePmMessage_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
