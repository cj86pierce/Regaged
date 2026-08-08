-- CreateTable
CREATE TABLE "RegagedShopItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "designType" "DesignType" NOT NULL,
    "designId" TEXT NOT NULL,
    "priceT" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegagedShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegagedShopPurchase" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegagedShopPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegagedShopItem_designId_key" ON "RegagedShopItem"("designId");

-- CreateIndex
CREATE INDEX "RegagedShopItem_active_sortOrder_idx" ON "RegagedShopItem"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "RegagedShopPurchase_userId_idx" ON "RegagedShopPurchase"("userId");

-- CreateIndex
CREATE INDEX "RegagedShopPurchase_itemId_idx" ON "RegagedShopPurchase"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "RegagedShopPurchase_userId_itemId_key" ON "RegagedShopPurchase"("userId", "itemId");

-- AddForeignKey
ALTER TABLE "RegagedShopItem" ADD CONSTRAINT "RegagedShopItem_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegagedShopPurchase" ADD CONSTRAINT "RegagedShopPurchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RegagedShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegagedShopPurchase" ADD CONSTRAINT "RegagedShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
