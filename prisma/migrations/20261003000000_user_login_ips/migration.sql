CREATE TABLE "UserLoginIp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loginCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "UserLoginIp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserLoginIp_userId_ip_key" ON "UserLoginIp"("userId", "ip");
CREATE INDEX "UserLoginIp_ip_lastSeenAt_idx" ON "UserLoginIp"("ip", "lastSeenAt");
ALTER TABLE "UserLoginIp" ADD CONSTRAINT "UserLoginIp_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
