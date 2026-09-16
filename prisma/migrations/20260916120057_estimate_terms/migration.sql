-- AlterTable
ALTER TABLE "estimates" ADD COLUMN     "exclusions" TEXT,
ADD COLUMN     "offerValidUntil" TIMESTAMPTZ(3),
ADD COLUMN     "terms" TEXT;
