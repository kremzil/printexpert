/*
  Warnings:

  - You are about to drop the column `companyName` on the `UserAddress` table. All the data in the column will be lost.
  - Made the column `companyName` on table `CompanyProfile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "CompanyProfile" ALTER COLUMN "companyName" SET NOT NULL;

-- AlterTable
ALTER TABLE "UserAddress" DROP COLUMN "companyName";
