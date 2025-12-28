-- CreateTable
CREATE TABLE "MicrosoftSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicrosoftSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftSubscription_userId_key" ON "MicrosoftSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MicrosoftSubscription_subscriptionId_key" ON "MicrosoftSubscription"("subscriptionId");

-- AddForeignKey
ALTER TABLE "MicrosoftSubscription" ADD CONSTRAINT "MicrosoftSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
