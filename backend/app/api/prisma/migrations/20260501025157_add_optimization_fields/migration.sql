-- AlterTable
ALTER TABLE "MatchCandidate" ADD COLUMN     "optimization_mode" TEXT,
ADD COLUMN     "rank" INTEGER,
ADD COLUMN     "score_breakdown" JSONB;

-- AlterTable
ALTER TABLE "Request" ADD COLUMN     "optimization_profile" TEXT NOT NULL DEFAULT 'balanced';
