-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "preferred_currency_code" VARCHAR(3),
ADD COLUMN     "registration_address" TEXT;

-- AlterTable
ALTER TABLE "FactoryProfile" ADD COLUMN     "preferred_currency_code" VARCHAR(3),
ADD COLUMN     "registration_address" TEXT;

-- AlterTable
ALTER TABLE "LogistProfile" ADD COLUMN     "preferred_currency_code" VARCHAR(3),
ADD COLUMN     "registration_address" TEXT;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_preferred_currency_code_fkey" FOREIGN KEY ("preferred_currency_code") REFERENCES "Currency"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactoryProfile" ADD CONSTRAINT "FactoryProfile_preferred_currency_code_fkey" FOREIGN KEY ("preferred_currency_code") REFERENCES "Currency"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogistProfile" ADD CONSTRAINT "LogistProfile_preferred_currency_code_fkey" FOREIGN KEY ("preferred_currency_code") REFERENCES "Currency"("code") ON DELETE SET NULL ON UPDATE CASCADE;
