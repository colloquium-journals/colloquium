-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "deadline_reminders" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "jobKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deadline_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deadline_reminders_jobKey_key" ON "deadline_reminders"("jobKey");

-- CreateIndex
CREATE INDEX "deadline_reminders_assignmentId_idx" ON "deadline_reminders"("assignmentId");

-- CreateIndex
CREATE INDEX "deadline_reminders_status_scheduledFor_idx" ON "deadline_reminders"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "deadline_reminders_assignmentId_daysBefore_key" ON "deadline_reminders"("assignmentId", "daysBefore");

-- AddForeignKey
ALTER TABLE "deadline_reminders" ADD CONSTRAINT "deadline_reminders_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "review_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
