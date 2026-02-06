-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "originalId" TEXT,
ADD COLUMN     "deviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contact_userId_originalId_key" ON "Contact"("userId", "originalId");
