-- CreateTable
CREATE TABLE "SimilarNameAlert" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "usernameA" TEXT NOT NULL,
    "usernameB" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissedAt" TIMESTAMP(3),

    CONSTRAINT "SimilarNameAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimilarNameAlert_dismissedAt_createdAt_idx" ON "SimilarNameAlert"("dismissedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimilarNameAlert_userAId_userBId_key" ON "SimilarNameAlert"("userAId", "userBId");
