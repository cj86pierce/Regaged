-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equippedColorId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_equippedColorId_fkey" FOREIGN KEY ("equippedColorId") REFERENCES "ColorLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
