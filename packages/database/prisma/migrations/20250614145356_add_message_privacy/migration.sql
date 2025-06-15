-- CreateEnum
CREATE TYPE "MessagePrivacy" AS ENUM ('PUBLIC', 'AUTHOR_VISIBLE', 'REVIEWER_ONLY', 'EDITOR_ONLY', 'ADMIN_ONLY');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "privacy" "MessagePrivacy" NOT NULL DEFAULT 'AUTHOR_VISIBLE';
