-- CreateEnum
CREATE TYPE "RatingTarget" AS ENUM ('LOGIST', 'FACTORY');

-- CreateTable
CREATE TABLE "Rating" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "rated_by_user_id" UUID NOT NULL,
    "target_type" "RatingTarget" NOT NULL,
    "target_profile_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rating_target_type_target_profile_id_idx" ON "Rating"("target_type", "target_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_transaction_id_rated_by_user_id_target_type_key" ON "Rating"("transaction_id", "rated_by_user_id", "target_type");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_rated_by_user_id_fkey" FOREIGN KEY ("rated_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
