ALTER TABLE "Category" ADD COLUMN "attributes_schema" JSONB;
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TABLE "FactoryCategory" (
 "id" UUID PRIMARY KEY, "factory_profile_id" UUID NOT NULL REFERENCES "FactoryProfile"("id"),
 "category_id" UUID NOT NULL REFERENCES "Category"("id"), "confirmed_at" TIMESTAMP(3),
 "is_active" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "FactoryCategory_factory_profile_id_category_id_key" UNIQUE ("factory_profile_id", "category_id")
);
CREATE TABLE "CategoryProposal" (
 "id" UUID PRIMARY KEY, "submitter_id" UUID NOT NULL REFERENCES "User"("id"),
 "name" TEXT NOT NULL, "description" TEXT NOT NULL,
 "parent_id" UUID REFERENCES "Category"("id"), "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
 "category_id" UUID REFERENCES "Category"("id"), "reviewer_id" UUID REFERENCES "User"("id"),
 "decision_note" TEXT, "decided_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "CategoryProposal_submitter_id_status_idx" ON "CategoryProposal"("submitter_id", "status");
CREATE TABLE "InventoryDraft" (
 "id" UUID PRIMARY KEY, "factory_profile_id" UUID NOT NULL REFERENCES "FactoryProfile"("id"),
 "data" JSONB NOT NULL, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "InventoryDraft_factory_profile_id_idx" ON "InventoryDraft"("factory_profile_id");
-- Provisional only: a factory must explicitly confirm each production category.
INSERT INTO "FactoryCategory" ("id", "factory_profile_id", "category_id")
SELECT md5(i."factory_profile_id"::text || ':' || p."category_id"::text)::uuid,
 i."factory_profile_id", p."category_id"
FROM "InventoryEntry" i JOIN "Item" p ON p."id" = i."item_id"
WHERE i."deleted_at" IS NULL AND p."deleted_at" IS NULL
GROUP BY i."factory_profile_id", p."category_id"
ON CONFLICT ("factory_profile_id", "category_id") DO NOTHING;
-- Small catalogue already used by local examples, not an external taxonomy.
INSERT INTO "Category" ("id", "slug", "default_name", "status", "updated_at", "attributes_schema") VALUES
 ('e53c0000-0000-4000-8000-000000000001', 'textile', 'Textile', 'ACTIVE', CURRENT_TIMESTAMP, '{"type":"object","required":["material"],"properties":{"material":{"type":"string"},"gsm":{"type":"number","minimum":1,"maximum":2000,"unit":"g/m2"}}}'::jsonb),
 ('e53c0000-0000-4000-8000-000000000002', 'electronics', 'Electronics', 'ACTIVE', CURRENT_TIMESTAMP, NULL),
 ('e53c0000-0000-4000-8000-000000000003', 'food', 'Food', 'ACTIVE', CURRENT_TIMESTAMP, NULL),
 ('e53c0000-0000-4000-8000-000000000004', 'packaging', 'Packaging', 'ACTIVE', CURRENT_TIMESTAMP, NULL)
ON CONFLICT ("slug") DO NOTHING;
