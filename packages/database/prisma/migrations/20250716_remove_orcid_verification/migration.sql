-- Remove ORCID verification fields while keeping orcidId for manual entry
ALTER TABLE "users" DROP COLUMN IF EXISTS "orcidVerified";
ALTER TABLE "users" DROP COLUMN IF EXISTS "orcidAccessToken";