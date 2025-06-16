-- AlterTable
ALTER TABLE "users" ADD COLUMN     "orcidVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orcidAccessToken" TEXT;