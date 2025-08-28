-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "provider_id" VARCHAR(100),
    "provider_name" VARCHAR(50),
    "email" VARCHAR(100) NOT NULL,
    "name" VARCHAR(100),
    "image" VARCHAR(500),
    "bio" VARCHAR(500),
    "website" VARCHAR(200),
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" VARCHAR(50),
    "stripeSubscriptionId" VARCHAR(50),
    "stripeSubscriptionStatus" VARCHAR(50),
    "currentPeriodEndAt" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_id_key" ON "public"."users"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");
