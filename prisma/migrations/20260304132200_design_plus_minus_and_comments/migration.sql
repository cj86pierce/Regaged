-- AlterTable: replace DesignVote with plus/minus (drop and recreate)
DROP TABLE IF EXISTS "DesignVote";

CREATE TABLE "DesignVote" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignVote_designId_userId_key" ON "DesignVote"("designId", "userId");
CREATE INDEX "DesignVote_designId_idx" ON "DesignVote"("designId");

ALTER TABLE "DesignVote" ADD CONSTRAINT "DesignVote_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignVote" ADD CONSTRAINT "DesignVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable DesignComment
CREATE TABLE "DesignComment" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DesignComment_designId_idx" ON "DesignComment"("designId");

ALTER TABLE "DesignComment" ADD CONSTRAINT "DesignComment_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignComment" ADD CONSTRAINT "DesignComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable DesignCommentVote
CREATE TABLE "DesignCommentVote" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReactionType" NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignCommentVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignCommentVote_commentId_userId_key" ON "DesignCommentVote"("commentId", "userId");
CREATE INDEX "DesignCommentVote_commentId_idx" ON "DesignCommentVote"("commentId");

ALTER TABLE "DesignCommentVote" ADD CONSTRAINT "DesignCommentVote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DesignComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignCommentVote" ADD CONSTRAINT "DesignCommentVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
