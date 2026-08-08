-- DropTable column: remove unused premium currency
ALTER TABLE "User" DROP COLUMN IF EXISTS "pMoney";
