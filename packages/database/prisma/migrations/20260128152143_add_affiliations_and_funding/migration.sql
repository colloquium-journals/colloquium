-- AlterTable
ALTER TABLE "manuscript_authors" ADD COLUMN     "affiliationOverride" TEXT,
ADD COLUMN     "creditRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "manuscripts" ADD COLUMN     "acceptedDate" TIMESTAMP(3),
ADD COLUMN     "articleType" TEXT,
ADD COLUMN     "crossrefDepositId" TEXT,
ADD COLUMN     "crossrefError" TEXT,
ADD COLUMN     "crossrefRegisteredAt" TIMESTAMP(3),
ADD COLUMN     "crossrefStatus" TEXT,
ADD COLUMN     "elocationId" TEXT,
ADD COLUMN     "issue" TEXT,
ADD COLUMN     "receivedDate" TIMESTAMP(3),
ADD COLUMN     "volume" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "givenNames" TEXT,
ADD COLUMN     "nameSuffix" TEXT,
ADD COLUMN     "surname" TEXT;

-- CreateTable
CREATE TABLE "affiliations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "department" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL,
    "countryCode" TEXT,
    "ror" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manuscript_funding" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "funderName" TEXT NOT NULL,
    "funderDoi" TEXT,
    "funderRor" TEXT,
    "awardId" TEXT,
    "awardTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manuscript_funding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliations_userId_idx" ON "affiliations"("userId");

-- CreateIndex
CREATE INDEX "manuscript_funding_manuscriptId_idx" ON "manuscript_funding"("manuscriptId");

-- AddForeignKey
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuscript_funding" ADD CONSTRAINT "manuscript_funding_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "manuscripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
