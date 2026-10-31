-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "branch_id" UUID,
    "title_en" TEXT NOT NULL,
    "title_ur" TEXT,
    "body_en" TEXT NOT NULL,
    "body_ur" TEXT,
    "happened_on" DATE,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(3),
    "image_alt_en" TEXT,
    "image_alt_ur" TEXT,
    "image_updated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "result_images" (
    "result_id" UUID NOT NULL,
    "data" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "result_images_pkey" PRIMARY KEY ("result_id")
);

-- CreateIndex
CREATE INDEX "results_status_published_at_idx" ON "results"("status", "published_at");

-- CreateIndex
CREATE INDEX "results_branch_id_idx" ON "results"("branch_id");

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "result_images" ADD CONSTRAINT "result_images_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
