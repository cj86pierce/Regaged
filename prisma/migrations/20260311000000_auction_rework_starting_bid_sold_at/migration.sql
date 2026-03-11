-- AlterTable
ALTER TABLE "Auction" ALTER COLUMN "currentBid" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "Auction" ADD COLUMN "soldAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Auction_soldAt_idx" ON "Auction"("soldAt");
