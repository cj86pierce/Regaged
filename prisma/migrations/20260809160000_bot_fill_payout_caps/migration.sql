-- Bot-filled live game payout caps (1 karma / 3 R$ payout games per UTC day)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "botFillPayoutGamesToday" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "botFillKarmaPaidToday" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "botFillPayoutResetDate" TEXT;

ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "botFilled" BOOLEAN NOT NULL DEFAULT false;
