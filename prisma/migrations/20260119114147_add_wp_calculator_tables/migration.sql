-- CreateTable
CREATE TABLE "WpMatrixType" (
    "mtypeId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "mtype" INTEGER NOT NULL,
    "title" TEXT,
    "defQuantity" INTEGER,
    "attributes" TEXT,
    "aterms" TEXT,
    "numbers" TEXT,
    "numStyle" INTEGER,
    "numType" INTEGER,
    "bqNumbers" TEXT,
    "ltextAttr" INTEGER,
    "bookMinQuantity" INTEGER,
    "pqStyle" INTEGER,
    "pqNumbers" TEXT,
    "sorder" INTEGER,
    "minQMailed" INTEGER,

    CONSTRAINT "WpMatrixType_pkey" PRIMARY KEY ("mtypeId")
);

-- CreateTable
CREATE TABLE "WpMatrixPrice" (
    "id" SERIAL NOT NULL,
    "mtypeId" INTEGER NOT NULL,
    "aterms" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "WpMatrixPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WpTerm" (
    "termId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "termGroup" INTEGER,

    CONSTRAINT "WpTerm_pkey" PRIMARY KEY ("termId")
);

-- CreateTable
CREATE TABLE "WpTermTaxonomy" (
    "termTaxonomyId" INTEGER NOT NULL,
    "termId" INTEGER NOT NULL,
    "taxonomy" TEXT NOT NULL,
    "description" TEXT,
    "parent" INTEGER,
    "count" INTEGER,

    CONSTRAINT "WpTermTaxonomy_pkey" PRIMARY KEY ("termTaxonomyId")
);

-- CreateTable
CREATE TABLE "WpTermRelationship" (
    "id" SERIAL NOT NULL,
    "objectId" INTEGER NOT NULL,
    "termTaxonomyId" INTEGER NOT NULL,
    "termOrder" INTEGER,

    CONSTRAINT "WpTermRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WpTermMeta" (
    "metaId" INTEGER NOT NULL,
    "termId" INTEGER NOT NULL,
    "metaKey" TEXT,
    "metaValue" TEXT,

    CONSTRAINT "WpTermMeta_pkey" PRIMARY KEY ("metaId")
);

-- CreateTable
CREATE TABLE "WpAttributeTaxonomy" (
    "attributeId" INTEGER NOT NULL,
    "attributeName" TEXT NOT NULL,
    "attributeLabel" TEXT NOT NULL,
    "attributeType" TEXT,
    "attributeOrder" INTEGER,
    "attributePublic" INTEGER,

    CONSTRAINT "WpAttributeTaxonomy_pkey" PRIMARY KEY ("attributeId")
);

-- CreateIndex
CREATE INDEX "WpMatrixPrice_mtypeId_idx" ON "WpMatrixPrice"("mtypeId");

-- CreateIndex
CREATE UNIQUE INDEX "WpMatrixPrice_mtypeId_aterms_number_key" ON "WpMatrixPrice"("mtypeId", "aterms", "number");

-- CreateIndex
CREATE INDEX "WpTermTaxonomy_termId_idx" ON "WpTermTaxonomy"("termId");

-- CreateIndex
CREATE INDEX "WpTermTaxonomy_taxonomy_idx" ON "WpTermTaxonomy"("taxonomy");

-- CreateIndex
CREATE INDEX "WpTermRelationship_objectId_idx" ON "WpTermRelationship"("objectId");

-- CreateIndex
CREATE INDEX "WpTermRelationship_termTaxonomyId_idx" ON "WpTermRelationship"("termTaxonomyId");

-- CreateIndex
CREATE UNIQUE INDEX "WpTermRelationship_objectId_termTaxonomyId_key" ON "WpTermRelationship"("objectId", "termTaxonomyId");

-- CreateIndex
CREATE INDEX "WpTermMeta_termId_idx" ON "WpTermMeta"("termId");

-- CreateIndex
CREATE INDEX "WpTermMeta_metaKey_idx" ON "WpTermMeta"("metaKey");
