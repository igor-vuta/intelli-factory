-- Requests waiting for a proposed category; published when the proposal is approved.
-- CreateTable
CREATE TABLE "PendingRequest" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "proposal_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "data" JSONB NOT NULL,
    "request_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingRequest_customer_profile_id_status_idx" ON "PendingRequest"("customer_profile_id", "status");

-- CreateIndex
CREATE INDEX "PendingRequest_proposal_id_status_idx" ON "PendingRequest"("proposal_id", "status");

-- AddForeignKey
ALTER TABLE "PendingRequest" ADD CONSTRAINT "PendingRequest_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingRequest" ADD CONSTRAINT "PendingRequest_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "CategoryProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
