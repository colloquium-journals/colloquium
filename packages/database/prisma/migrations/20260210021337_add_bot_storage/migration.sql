/*
  Warnings:

  - You are about to drop the `bot_permissions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bot_permissions" DROP CONSTRAINT "bot_permissions_botId_fkey";

-- DropTable
DROP TABLE "bot_permissions";

-- CreateTable
CREATE TABLE "bot_storage" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_storage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_storage_botId_manuscriptId_idx" ON "bot_storage"("botId", "manuscriptId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_storage_botId_manuscriptId_key_key" ON "bot_storage"("botId", "manuscriptId", "key");

-- CreateIndex
CREATE INDEX "action_editors_editorId_idx" ON "action_editors"("editorId");

-- CreateIndex
CREATE INDEX "manuscripts_status_idx" ON "manuscripts"("status");

-- CreateIndex
CREATE INDEX "manuscripts_workflowPhase_idx" ON "manuscripts"("workflowPhase");

-- CreateIndex
CREATE INDEX "messages_conversationId_idx" ON "messages"("conversationId");

-- AddForeignKey
ALTER TABLE "bot_storage" ADD CONSTRAINT "bot_storage_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "manuscripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
