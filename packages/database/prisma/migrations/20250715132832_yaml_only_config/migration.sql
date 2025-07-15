/*
  Warnings:

  - You are about to drop the column `configFormat` on the `bot_installs` table. All the data in the column will be lost.
  - You are about to drop the column `rawConfig` on the `bot_installs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bot_installs" DROP COLUMN "configFormat",
DROP COLUMN "rawConfig",
ADD COLUMN     "yamlConfig" TEXT;
