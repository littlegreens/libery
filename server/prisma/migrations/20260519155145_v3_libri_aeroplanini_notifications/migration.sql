/*
  Warnings:

  - You are about to drop the column `pending_copies` on the `point_books` table. All the data in the column will be lost.
  - You are about to drop the column `timbri` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `user_badges` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis_tiger_geocoder";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis_topology";

-- AlterEnum
ALTER TYPE "BookSource" ADD VALUE 'open_library';

-- DropForeignKey
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_badges" DROP CONSTRAINT "user_badges_user_id_fkey";

-- AlterTable
ALTER TABLE "point_books" DROP COLUMN "pending_copies",
ALTER COLUMN "last_updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "timbri",
ADD COLUMN     "libri_extra" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "libri_oggi_used" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "user_badges";

-- CreateTable
CREATE TABLE "user_aeroplanini" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_aeroplanini_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_aeroplanini_user_id_type_key" ON "user_aeroplanini"("user_id", "type");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_point_id_created_at_idx" ON "transactions"("point_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_book_id_created_at_idx" ON "transactions"("book_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_aeroplanini" ADD CONSTRAINT "user_aeroplanini_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
