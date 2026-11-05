-- Add three optional fields to the Scheme table to support the scheme import
-- pipeline (myScheme portal data) and deduplication.
--
-- myschemeSlug: unique identifier from the myScheme portal (e.g. "pm-kisan").
--               Null for manually-created schemes.
-- level:        Government level — "Central Government" or "State Government".
--               Null for manually-created schemes without a sourced level.
-- myschemeUrl:  Canonical myScheme portal page URL for source traceability.
--               Null for manually-created schemes.
--
-- All three columns are nullable so every existing Scheme row is unaffected.

-- AlterTable
ALTER TABLE "Scheme" ADD COLUMN "level"        TEXT,
                     ADD COLUMN "myschemeSlug"  TEXT,
                     ADD COLUMN "myschemeUrl"   TEXT;

-- Unique constraint — one DB row per myScheme portal slug
CREATE UNIQUE INDEX "Scheme_myschemeSlug_key" ON "Scheme"("myschemeSlug");

-- Index to support filtering schemes by government level
CREATE INDEX "Scheme_level_idx" ON "Scheme"("level");
