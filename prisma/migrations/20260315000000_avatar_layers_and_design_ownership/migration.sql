-- Design ownership and equipped designs (User can own designs and equip per slot)
-- Avatar layers: glasses, scar, hair ornament, background color

-- 1. Create DesignOwner table (skip if you already have it)
CREATE TABLE IF NOT EXISTS "DesignOwner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignOwner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DesignOwner_userId_designId_key" ON "DesignOwner"("userId", "designId");
CREATE INDEX IF NOT EXISTS "DesignOwner_userId_idx" ON "DesignOwner"("userId");
CREATE INDEX IF NOT EXISTS "DesignOwner_designId_idx" ON "DesignOwner"("designId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DesignOwner_userId_fkey') THEN
    ALTER TABLE "DesignOwner" ADD CONSTRAINT "DesignOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DesignOwner_designId_fkey') THEN
    ALTER TABLE "DesignOwner" ADD CONSTRAINT "DesignOwner_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Add new DesignType enum values (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'DesignType' AND e.enumlabel = 'BACKGROUND') THEN
    ALTER TYPE "DesignType" ADD VALUE 'BACKGROUND';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'DesignType' AND e.enumlabel = 'SCAR') THEN
    ALTER TYPE "DesignType" ADD VALUE 'SCAR';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'DesignType' AND e.enumlabel = 'HAIR_ORNAMENT') THEN
    ALTER TYPE "DesignType" ADD VALUE 'HAIR_ORNAMENT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'DesignType' AND e.enumlabel = 'GLASSES') THEN
    ALTER TYPE "DesignType" ADD VALUE 'GLASSES';
  END IF;
END $$;

-- 3. User: new avatar style/color columns (ignore errors if column already exists)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "glassesStyle" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scarStyle" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hairOrnamentStyle" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "backgroundColor" TEXT NOT NULL DEFAULT '#E8E8E8';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "glassesColor" TEXT NOT NULL DEFAULT '#111111';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "scarColor" TEXT NOT NULL DEFAULT '#8B4513';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hairOrnamentColor" TEXT NOT NULL DEFAULT '#C0C0C0';

-- 4. User: equipped design IDs (nullable FKs to Design)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedShirtDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedHairDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedBodyDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedEyesDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedMouthDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedAccessoryDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedBackgroundDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedScarDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedHairOrnamentDesignId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "equippedGlassesDesignId" TEXT;

-- Add FKs only if column exists and constraint not present (PostgreSQL has no IF NOT EXISTS for constraints; run once)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedShirtDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedShirtDesignId_fkey" FOREIGN KEY ("equippedShirtDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedHairDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedHairDesignId_fkey" FOREIGN KEY ("equippedHairDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedBodyDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedBodyDesignId_fkey" FOREIGN KEY ("equippedBodyDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedEyesDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedEyesDesignId_fkey" FOREIGN KEY ("equippedEyesDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedMouthDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedMouthDesignId_fkey" FOREIGN KEY ("equippedMouthDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedAccessoryDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedAccessoryDesignId_fkey" FOREIGN KEY ("equippedAccessoryDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedBackgroundDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedBackgroundDesignId_fkey" FOREIGN KEY ("equippedBackgroundDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedScarDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedScarDesignId_fkey" FOREIGN KEY ("equippedScarDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedHairOrnamentDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedHairOrnamentDesignId_fkey" FOREIGN KEY ("equippedHairOrnamentDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_equippedGlassesDesignId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_equippedGlassesDesignId_fkey" FOREIGN KEY ("equippedGlassesDesignId") REFERENCES "Design"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
