-- Shared catalogue: original-language labels, lifecycle state, product identity, merge redirects
-- and language-tagged aliases. Adds columns only; existing IDs, names, translations and every
-- commercial reference are left untouched. Historical labels keep an unknown source language.
ALTER TABLE "Category"
  ADD COLUMN "source_locale" VARCHAR(2),
  ADD COLUMN "record_state" TEXT NOT NULL DEFAULT 'ESTABLISHED';
ALTER TABLE "Item"
  ADD COLUMN "source_locale" VARCHAR(2),
  ADD COLUMN "record_state" TEXT NOT NULL DEFAULT 'ESTABLISHED',
  ADD COLUMN "identity_attributes" JSONB,
  ADD COLUMN "merged_into_id" UUID;
ALTER TABLE "Item" ADD CONSTRAINT "Item_merged_into_id_fkey" FOREIGN KEY ("merged_into_id")
  REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CategoryTranslation" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ItemTranslation" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "Item_merged_into_id_idx" ON "Item"("merged_into_id");
