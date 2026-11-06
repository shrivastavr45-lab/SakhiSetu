import express, { Router } from "express";
import { UserRole } from "@prisma/client";
import { importSchemesCsv } from "../controllers/import.controller.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { IMPORT_MAX_BYTES } from "../services/import.service.js";

export const adminImportRouter = Router();

// All import endpoints require an authenticated ADMIN session.
adminImportRouter.use(authenticate, requireRole(UserRole.ADMIN));

// Parse CSV request body as plain text (bypasses the global JSON parser).
// The limit matches the service-level IMPORT_MAX_BYTES constant.
const csvTextParser = express.text({
  type: ["text/csv", "text/plain", "application/octet-stream"],
  limit: IMPORT_MAX_BYTES,
});

/**
 * POST /admin/import/schemes/csv
 *
 * Body: raw CSV text (Content-Type: text/csv or text/plain)
 * Auth: ADMIN session cookie
 *
 * Returns: ImportSummary — { totalRows, imported, skippedDuplicates, skippedInvalid, errors }
 */
adminImportRouter.post("/schemes/csv", csvTextParser, asyncHandler(importSchemesCsv));
