-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('FASTING');

-- CreateEnum
CREATE TYPE "GameState" AS ENUM ('ENROLLING', 'ROUND_NOMINATE', 'ROUND_VOTE', 'FINAL3', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('ACTIVE', 'ELIMINATED');

-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('PLUS', 'MINUS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "karma" INTEGER NOT NULL DEFAULT 0,
    "tMoney" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorLevel" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "karmaNeeded" INTEGER NOT NULL,
    "priceT" INTEGER NOT NULL,
    "strength" INTEGER NOT NULL,
    "isAnimated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ColorLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserColor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "colorId" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "state" "GameState" NOT NULL DEFAULT 'ENROLLING',
    "roundNumber" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "stateEndsAt" TIMESTAMP(3),
    "povUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GamePlayer" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlayerStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eliminatedAt" TIMESTAMP(3),
    "povWins" INTEGER NOT NULL DEFAULT 0,
    "chatCount" INTEGER NOT NULL DEFAULT 0,
    "plusCount" INTEGER NOT NULL DEFAULT 0,
    "minusCount" INTEGER NOT NULL DEFAULT 0,
    "lastHadPovRound" INTEGER,

    CONSTRAINT "GamePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nomination" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvictionVote" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "voterUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvictionVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundResult" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "nomineeAUserId" TEXT NOT NULL,
    "nomineeBUserId" TEXT NOT NULL,
    "evictedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMessage" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "ChatChannel" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "reactorUserId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "ColorLevel_name_key" ON "ColorLevel"("name");

-- CreateIndex
CREATE INDEX "UserColor_userId_idx" ON "UserColor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserColor_userId_colorId_key" ON "UserColor"("userId", "colorId");

-- CreateIndex
CREATE INDEX "Enrollment_gameType_createdAt_idx" ON "Enrollment"("gameType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_userId_gameType_key" ON "Enrollment"("userId", "gameType");

-- CreateIndex
CREATE INDEX "Game_state_stateEndsAt_idx" ON "Game"("state", "stateEndsAt");

-- CreateIndex
CREATE INDEX "GamePlayer_gameId_status_idx" ON "GamePlayer"("gameId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayer_gameId_userId_key" ON "GamePlayer"("gameId", "userId");

-- CreateIndex
CREATE INDEX "Nomination_gameId_roundNumber_idx" ON "Nomination"("gameId", "roundNumber");

-- CreateIndex
CREATE INDEX "Nomination_gameId_roundNumber_targetUserId_idx" ON "Nomination"("gameId", "roundNumber", "targetUserId");

-- CreateIndex
CREATE INDEX "EvictionVote_gameId_roundNumber_targetUserId_idx" ON "EvictionVote"("gameId", "roundNumber", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "EvictionVote_gameId_roundNumber_voterUserId_key" ON "EvictionVote"("gameId", "roundNumber", "voterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RoundResult_gameId_roundNumber_key" ON "RoundResult"("gameId", "roundNumber");

-- CreateIndex
CREATE INDEX "GameMessage_gameId_channel_createdAt_idx" ON "GameMessage"("gameId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_type_idx" ON "MessageReaction"("messageId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_reactorUserId_key" ON "MessageReaction"("messageId", "reactorUserId");

-- AddForeignKey
ALTER TABLE "UserColor" ADD CONSTRAINT "UserColor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserColor" ADD CONSTRAINT "UserColor_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "ColorLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GamePlayer" ADD CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nomination" ADD CONSTRAINT "Nomination_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvictionVote" ADD CONSTRAINT "EvictionVote_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundResult" ADD CONSTRAINT "RoundResult_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMessage" ADD CONSTRAINT "GameMessage_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMessage" ADD CONSTRAINT "GameMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GameMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_reactorUserId_fkey" FOREIGN KEY ("reactorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
