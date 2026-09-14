ALTER TABLE "User" ADD COLUMN "preferred_locale" VARCHAR(2);
ALTER TABLE "User" ADD CONSTRAINT "User_preferred_locale_check" CHECK ("preferred_locale" IN ('en', 'ru', 'kk'));
