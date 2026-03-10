-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'FACTORY', 'LOGIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'PAIRING_IN_PROGRESS', 'MATCHED', 'CONTRACT_DRAFTED', 'CONTRACT_SIGNING', 'FULLY_SIGNED', 'AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'FULFILLMENT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('PENDING', 'REJECTED', 'ACCEPTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('CONTRACT_DRAFTED', 'CONTRACT_SIGNING', 'FULLY_SIGNED', 'AWAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'FULFILLMENT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VerificationTokenType" AS ENUM ('EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_type" "VerificationTokenType" NOT NULL DEFAULT 'EMAIL_VERIFICATION',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "phone" TEXT,
    "primary_address_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactoryProfile" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "primary_address_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "FactoryProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogistProfile" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "primary_address_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "LogistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" UUID NOT NULL,
    "iso2" VARCHAR(2) NOT NULL,
    "iso3" VARCHAR(3) NOT NULL,
    "default_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CountryTranslation" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CountryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "default_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionTranslation" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "RegionTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "default_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CityTranslation" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CityTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "street" TEXT NOT NULL,
    "postal_code" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "default_name" TEXT NOT NULL,
    "parent_id" UUID,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryTranslation" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Item" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "characteristics_schema" JSONB,
    "unit" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemTranslation" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "ItemTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Currency" (
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "is_base_currency" BOOLEAN NOT NULL DEFAULT false,
    "exchange_rate_to_base" DECIMAL(18,8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "InventoryEntry" (
    "id" UUID NOT NULL,
    "factory_profile_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "stock_address_id" UUID NOT NULL,
    "quantity_available" DECIMAL(18,4) NOT NULL,
    "price_per_unit" DECIMAL(18,4) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "characteristics_json" JSONB,
    "status" "EntityStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "InventoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Request" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "item_id" UUID,
    "requested_name_text" TEXT,
    "requested_characteristics_json" JSONB,
    "quantity" DECIMAL(18,4) NOT NULL,
    "destination_address_id" UUID NOT NULL,
    "preferred_currency_code" VARCHAR(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticOffer" (
    "id" UUID NOT NULL,
    "logist_profile_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(18,4) NOT NULL,
    "price_per_km" DECIMAL(18,4),
    "price_per_kg" DECIMAL(18,4),
    "estimated_days_min" INTEGER,
    "estimated_days_max" INTEGER,
    "reliability_score" DOUBLE PRECISION NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "LogisticOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsCoverageArea" (
    "id" UUID NOT NULL,
    "logistic_offer_id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "region_id" UUID,
    "city_id" UUID,
    "street_pattern" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "LogisticsCoverageArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchCandidate" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "inventory_entry_id" UUID NOT NULL,
    "logistic_offer_id" UUID NOT NULL,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "delivery_days" INTEGER NOT NULL,
    "reliability_score" DOUBLE PRECISION NOT NULL,
    "fitness_score" DOUBLE PRECISION NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "status" "CandidateStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "MatchCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "selected_candidate_id" UUID,
    "status" "TransactionStatus" NOT NULL DEFAULT 'CONTRACT_DRAFTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractPacket" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "document_hash" TEXT NOT NULL,
    "terms_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "ContractPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signature" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_at_signing" "UserRole" NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signed_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reference" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "transaction_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_deleted_at_idx" ON "User"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Session_session_token_hash_key" ON "Session"("session_token_hash");

-- CreateIndex
CREATE INDEX "Session_user_id_revoked_at_idx" ON "Session"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "Session_expires_at_idx" ON "Session"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_hash_key" ON "VerificationToken"("token_hash");

-- CreateIndex
CREATE INDEX "VerificationToken_user_id_token_type_idx" ON "VerificationToken"("user_id", "token_type");

-- CreateIndex
CREATE INDEX "VerificationToken_expires_at_consumed_at_idx" ON "VerificationToken"("expires_at", "consumed_at");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_user_id_key" ON "CustomerProfile"("user_id");

-- CreateIndex
CREATE INDEX "CustomerProfile_deleted_at_idx" ON "CustomerProfile"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "FactoryProfile_user_id_key" ON "FactoryProfile"("user_id");

-- CreateIndex
CREATE INDEX "FactoryProfile_deleted_at_idx" ON "FactoryProfile"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "LogistProfile_user_id_key" ON "LogistProfile"("user_id");

-- CreateIndex
CREATE INDEX "LogistProfile_deleted_at_idx" ON "LogistProfile"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso2_key" ON "Country"("iso2");

-- CreateIndex
CREATE UNIQUE INDEX "Country_iso3_key" ON "Country"("iso3");

-- CreateIndex
CREATE INDEX "Country_is_active_idx" ON "Country"("is_active");

-- CreateIndex
CREATE INDEX "CountryTranslation_locale_idx" ON "CountryTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CountryTranslation_country_id_locale_key" ON "CountryTranslation"("country_id", "locale");

-- CreateIndex
CREATE INDEX "Region_is_active_idx" ON "Region"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Region_country_id_code_key" ON "Region"("country_id", "code");

-- CreateIndex
CREATE INDEX "RegionTranslation_locale_idx" ON "RegionTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "RegionTranslation_region_id_locale_key" ON "RegionTranslation"("region_id", "locale");

-- CreateIndex
CREATE INDEX "City_is_active_idx" ON "City"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "City_region_id_default_name_key" ON "City"("region_id", "default_name");

-- CreateIndex
CREATE INDEX "CityTranslation_locale_idx" ON "CityTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CityTranslation_city_id_locale_key" ON "CityTranslation"("city_id", "locale");

-- CreateIndex
CREATE INDEX "Address_country_id_region_id_city_id_idx" ON "Address"("country_id", "region_id", "city_id");

-- CreateIndex
CREATE INDEX "Address_deleted_at_idx" ON "Address"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_status_deleted_at_idx" ON "Category"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "CategoryTranslation_locale_idx" ON "CategoryTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryTranslation_category_id_locale_key" ON "CategoryTranslation"("category_id", "locale");

-- CreateIndex
CREATE INDEX "Item_status_deleted_at_idx" ON "Item"("status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Item_category_id_normalized_name_key" ON "Item"("category_id", "normalized_name");

-- CreateIndex
CREATE INDEX "ItemTranslation_locale_idx" ON "ItemTranslation"("locale");

-- CreateIndex
CREATE UNIQUE INDEX "ItemTranslation_item_id_locale_key" ON "ItemTranslation"("item_id", "locale");

-- CreateIndex
CREATE INDEX "InventoryEntry_factory_profile_id_status_deleted_at_idx" ON "InventoryEntry"("factory_profile_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "InventoryEntry_item_id_status_deleted_at_idx" ON "InventoryEntry"("item_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "InventoryEntry_stock_address_id_idx" ON "InventoryEntry"("stock_address_id");

-- CreateIndex
CREATE INDEX "Request_customer_profile_id_status_deleted_at_idx" ON "Request"("customer_profile_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "Request_category_id_item_id_status_idx" ON "Request"("category_id", "item_id", "status");

-- CreateIndex
CREATE INDEX "LogisticOffer_logist_profile_id_status_deleted_at_idx" ON "LogisticOffer"("logist_profile_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "LogisticsCoverageArea_logistic_offer_id_status_deleted_at_idx" ON "LogisticsCoverageArea"("logistic_offer_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "LogisticsCoverageArea_country_id_region_id_city_id_idx" ON "LogisticsCoverageArea"("country_id", "region_id", "city_id");

-- CreateIndex
CREATE INDEX "MatchCandidate_request_id_status_deleted_at_idx" ON "MatchCandidate"("request_id", "status", "deleted_at");

-- CreateIndex
CREATE INDEX "MatchCandidate_fitness_score_idx" ON "MatchCandidate"("fitness_score");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_request_id_key" ON "Transaction"("request_id");

-- CreateIndex
CREATE INDEX "Transaction_status_deleted_at_idx" ON "Transaction"("status", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPacket_transaction_id_key" ON "ContractPacket"("transaction_id");

-- CreateIndex
CREATE INDEX "ContractPacket_generated_at_idx" ON "ContractPacket"("generated_at");

-- CreateIndex
CREATE INDEX "Signature_transaction_id_status_idx" ON "Signature"("transaction_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Signature_transaction_id_user_id_key" ON "Signature"("transaction_id", "user_id");

-- CreateIndex
CREATE INDEX "Payment_transaction_id_status_idx" ON "Payment"("transaction_id", "status");

-- CreateIndex
CREATE INDEX "EventLog_entity_type_entity_id_idx" ON "EventLog"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "EventLog_event_type_created_at_idx" ON "EventLog"("event_type", "created_at");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationToken" ADD CONSTRAINT "VerificationToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_primary_address_id_fkey" FOREIGN KEY ("primary_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryProfile" ADD CONSTRAINT "FactoryProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryProfile" ADD CONSTRAINT "FactoryProfile_primary_address_id_fkey" FOREIGN KEY ("primary_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogistProfile" ADD CONSTRAINT "LogistProfile_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogistProfile" ADD CONSTRAINT "LogistProfile_primary_address_id_fkey" FOREIGN KEY ("primary_address_id") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryTranslation" ADD CONSTRAINT "CountryTranslation_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionTranslation" ADD CONSTRAINT "RegionTranslation_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "City" ADD CONSTRAINT "City_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CityTranslation" ADD CONSTRAINT "CityTranslation_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemTranslation" ADD CONSTRAINT "ItemTranslation_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_factory_profile_id_fkey" FOREIGN KEY ("factory_profile_id") REFERENCES "FactoryProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_stock_address_id_fkey" FOREIGN KEY ("stock_address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryEntry" ADD CONSTRAINT "InventoryEntry_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_destination_address_id_fkey" FOREIGN KEY ("destination_address_id") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Request" ADD CONSTRAINT "Request_preferred_currency_code_fkey" FOREIGN KEY ("preferred_currency_code") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticOffer" ADD CONSTRAINT "LogisticOffer_logist_profile_id_fkey" FOREIGN KEY ("logist_profile_id") REFERENCES "LogistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticOffer" ADD CONSTRAINT "LogisticOffer_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsCoverageArea" ADD CONSTRAINT "LogisticsCoverageArea_logistic_offer_id_fkey" FOREIGN KEY ("logistic_offer_id") REFERENCES "LogisticOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsCoverageArea" ADD CONSTRAINT "LogisticsCoverageArea_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsCoverageArea" ADD CONSTRAINT "LogisticsCoverageArea_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsCoverageArea" ADD CONSTRAINT "LogisticsCoverageArea_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_inventory_entry_id_fkey" FOREIGN KEY ("inventory_entry_id") REFERENCES "InventoryEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_logistic_offer_id_fkey" FOREIGN KEY ("logistic_offer_id") REFERENCES "LogisticOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchCandidate" ADD CONSTRAINT "MatchCandidate_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_selected_candidate_id_fkey" FOREIGN KEY ("selected_candidate_id") REFERENCES "MatchCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractPacket" ADD CONSTRAINT "ContractPacket_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLog" ADD CONSTRAINT "EventLog_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
