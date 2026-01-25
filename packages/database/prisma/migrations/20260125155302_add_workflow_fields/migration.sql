-- CreateEnum
CREATE TYPE "WorkflowPhase" AS ENUM ('REVIEW', 'DELIBERATION', 'RELEASED', 'AUTHOR_RESPONDING');

-- AlterTable
ALTER TABLE "manuscripts" ADD COLUMN     "releasedAt" TIMESTAMP(3),
ADD COLUMN     "workflowPhase" "WorkflowPhase" NOT NULL DEFAULT 'REVIEW',
ADD COLUMN     "workflowRound" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "workflow_releases" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedBy" TEXT NOT NULL,
    "decisionType" TEXT,
    "notes" TEXT,

    CONSTRAINT "workflow_releases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "workflow_releases" ADD CONSTRAINT "workflow_releases_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "manuscripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_releases" ADD CONSTRAINT "workflow_releases_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
