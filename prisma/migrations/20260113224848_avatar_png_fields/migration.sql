-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'FASTING_LITE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessoryColor" TEXT NOT NULL DEFAULT '#111111',
ADD COLUMN     "accessoryStyle" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN     "mouthColor" TEXT NOT NULL DEFAULT '#E0AC69',
ALTER COLUMN "bodyStyle" SET DEFAULT 'body_m',
ALTER COLUMN "eyesStyle" SET DEFAULT 'eyes_01',
ALTER COLUMN "hairStyle" SET DEFAULT 'hair_m_01',
ALTER COLUMN "mouthStyle" SET DEFAULT 'mouth_01',
ALTER COLUMN "shirtStyle" SET DEFAULT 'shirt_01';
