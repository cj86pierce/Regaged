-- CreateEnum
CREATE TYPE "DesignType" AS ENUM ('BODY', 'HAIR', 'EYES', 'MOUTH', 'SHIRT', 'ACCESSORY');

-- AlterTable
ALTER TABLE "Design" ADD COLUMN "designType" "DesignType" NOT NULL DEFAULT 'HAIR';

-- CreateIndex
CREATE INDEX "Design_designType_idx" ON "Design"("designType");

-- Set design "Leon" (case-insensitive) to HAIR
UPDATE "Design" SET "designType" = 'HAIR' WHERE LOWER("title") = 'leon';
