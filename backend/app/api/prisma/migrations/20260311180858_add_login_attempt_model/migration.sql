-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "was_successful" BOOLEAN NOT NULL DEFAULT false,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LoginAttempt_email_attempted_at_idx" ON "LoginAttempt"("email", "attempted_at");

-- CreateIndex
CREATE INDEX "LoginAttempt_ip_address_attempted_at_idx" ON "LoginAttempt"("ip_address", "attempted_at");
