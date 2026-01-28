-- CreateEnum
CREATE TYPE "WaitlistPlatform" AS ENUM ('WINDOWS', 'LINUX', 'IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('OBJECTION_RESPONSE', 'TALKING_POINT', 'QUESTION', 'CLOSING_TECHNIQUE', 'TOPIC_EXPERTISE');

-- CreateTable
CREATE TABLE "Waitlist" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "platform" "WaitlistPlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeAtom" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "type" "KnowledgeType" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeAtom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "responseId" TEXT,
    "sessionId" TEXT,
    "isHelpful" BOOLEAN NOT NULL,
    "atomsUsed" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "industry" TEXT,
    "communicationStyle" TEXT,
    "topExpertise" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Waitlist_email_key" ON "Waitlist"("email");

-- CreateIndex
CREATE INDEX "Waitlist_platform_idx" ON "Waitlist"("platform");

-- CreateIndex
CREATE INDEX "KnowledgeAtom_userId_type_idx" ON "KnowledgeAtom"("userId", "type");

-- CreateIndex
CREATE INDEX "KnowledgeAtom_userId_createdAt_idx" ON "KnowledgeAtom"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AIFeedback_userId_createdAt_idx" ON "AIFeedback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- AddForeignKey
ALTER TABLE "KnowledgeAtom" ADD CONSTRAINT "KnowledgeAtom_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeAtom" ADD CONSTRAINT "KnowledgeAtom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SyncedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIFeedback" ADD CONSTRAINT "AIFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
