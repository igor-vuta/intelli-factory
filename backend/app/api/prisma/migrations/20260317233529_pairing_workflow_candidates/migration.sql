-- DropForeignKey
ALTER TABLE "MatchCandidate" DROP CONSTRAINT "MatchCandidate_logistic_offer_id_fkey";

-- AlterTable
ALTER TABLE "MatchCandidate" ADD COLUMN     "delivery_price" DECIMAL(18,4),
ADD COLUMN     "factory_note" TEXT,
ADD COLUMN     "quoted_quantity" DECIMAL(18,4),
ALTER COLUMN "logistic_offer_id" DROP NOT NULL,
ALTER COLUMN "total_cost" DROP NOT NULL,
ALTER COLUMN "delivery_days" DROP NOT NULL,
ALTER COLUMN "reliability_score" DROP NOT NULL,
ALTER COLUMN "fitness_score" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_logistic_offer_id_fkey" FOREIGN KEY ("logistic_offer_id") REFERENCES "LogisticOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
