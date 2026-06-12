-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('STRIPE', 'APPLE');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "provider" "SubscriptionProvider" NOT NULL DEFAULT 'STRIPE';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appAccountToken" TEXT;

-- CreateTable
CREATE TABLE "AppleTransaction" (
    "originalTransactionId" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppleTransaction_pkey" PRIMARY KEY ("originalTransactionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_appAccountToken_key" ON "User"("appAccountToken");

-- CreateIndex
CREATE INDEX "AppleTransaction_userId_idx" ON "AppleTransaction"("userId");

-- AddForeignKey
ALTER TABLE "AppleTransaction" ADD CONSTRAINT "AppleTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
