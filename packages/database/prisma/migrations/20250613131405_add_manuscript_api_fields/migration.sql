-- AlterTable
ALTER TABLE "manuscripts" ADD COLUMN     "authors" TEXT[],
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMP(3);
