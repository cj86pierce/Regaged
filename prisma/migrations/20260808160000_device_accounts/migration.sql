-- CreateTable
CREATE TABLE "DeviceAccount" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceAccount_deviceId_idx" ON "DeviceAccount"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceAccount_userId_idx" ON "DeviceAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAccount_deviceId_userId_key" ON "DeviceAccount"("deviceId", "userId");

-- AddForeignKey
ALTER TABLE "DeviceAccount" ADD CONSTRAINT "DeviceAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
