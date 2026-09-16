-- AlterTable
ALTER TABLE "procurement_requests" ADD COLUMN     "notificationError" TEXT,
ADD COLUMN     "notificationStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "notifiedAt" TIMESTAMPTZ(3);
