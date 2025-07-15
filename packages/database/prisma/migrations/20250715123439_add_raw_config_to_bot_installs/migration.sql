/*
  Warnings:

  - You are about to drop the column `config` on the `bot_definitions` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "BotExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('ADMIN', 'EDITOR_IN_CHIEF', 'ACTION_EDITOR', 'USER', 'BOT');

-- CreateEnum
CREATE TYPE "ManuscriptFileType" AS ENUM ('SOURCE', 'ASSET', 'RENDERED', 'SUPPLEMENTARY');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('LOCAL', 'S3', 'GCS', 'AZURE');

-- AlterEnum
ALTER TYPE "ManuscriptStatus" ADD VALUE 'RETRACTED';

-- AlterTable
ALTER TABLE "bot_definitions" DROP COLUMN "config",
ADD COLUMN     "configSchema" JSONB,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "supportsFileUploads" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "bot_installs" ADD COLUMN     "rawConfig" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "manuscript_files" ADD COLUMN     "checksum" TEXT,
ADD COLUMN     "detectedFormat" TEXT,
ADD COLUMN     "encoding" TEXT,
ADD COLUMN     "fileExtension" TEXT,
ADD COLUMN     "fileType" "ManuscriptFileType" NOT NULL DEFAULT 'SOURCE',
ADD COLUMN     "storageType" "StorageType" NOT NULL DEFAULT 'LOCAL';

-- AlterTable
ALTER TABLE "manuscripts" ADD COLUMN     "doi" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "editedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "GlobalRole" NOT NULL DEFAULT 'USER';

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "action_editors" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "action_editors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_actions" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_config_files" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_config_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_executions" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "actionId" TEXT,
    "messageId" TEXT,
    "status" "BotExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bot_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_permissions" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "bot_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supported_formats" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fileExtensions" TEXT[],
    "mimeTypes" TEXT[],
    "description" TEXT,
    "rendererBotId" TEXT,
    "validatorBotId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supported_formats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "action_editors_manuscriptId_key" ON "action_editors"("manuscriptId");

-- CreateIndex
CREATE UNIQUE INDEX "bot_actions_botId_name_key" ON "bot_actions"("botId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "bot_config_files_botId_filename_key" ON "bot_config_files"("botId", "filename");

-- CreateIndex
CREATE UNIQUE INDEX "bot_permissions_botId_permission_key" ON "bot_permissions"("botId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "supported_formats_name_key" ON "supported_formats"("name");

-- AddForeignKey
ALTER TABLE "action_editors" ADD CONSTRAINT "action_editors_assignedBy_fkey" FOREIGN KEY ("assignedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_editors" ADD CONSTRAINT "action_editors_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_editors" ADD CONSTRAINT "action_editors_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "manuscripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_actions" ADD CONSTRAINT "bot_actions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_config_files" ADD CONSTRAINT "bot_config_files_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_config_files" ADD CONSTRAINT "bot_config_files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_executions" ADD CONSTRAINT "bot_executions_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "bot_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_executions" ADD CONSTRAINT "bot_executions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_executions" ADD CONSTRAINT "bot_executions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_permissions" ADD CONSTRAINT "bot_permissions_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
