-- AlterTable: add povSavedUserId to Game for FROOKIES (who POV saved this round, before noms)
ALTER TABLE "Game" ADD COLUMN "povSavedUserId" TEXT;
