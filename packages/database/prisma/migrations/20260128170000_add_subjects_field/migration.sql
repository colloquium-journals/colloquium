-- Add subjects field for PMC/JATS subject classification
ALTER TABLE "manuscripts" ADD COLUMN "subjects" TEXT[] DEFAULT ARRAY[]::TEXT[];
