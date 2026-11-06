import type { RequestHandler } from "express";
import { importSchemesFromCsvText, IMPORT_MAX_BYTES } from "../services/import.service.js";
import { AppError } from "../utils/errors.js";

/**
 * POST /admin/import/schemes/csv
 *
 * Accepts a CSV file as:
 *   - Content-Type: text/csv  (body is the raw CSV text)
 *   - Content-Type: text/plain (same)
 *   - Content-Type: application/octet-stream (same)
 *
 * The JSON body parser is bypassed for these content types; Express reads the
 * raw body instead. A dedicated text body parser is added in the route file.
 *
 * Returns: { data: ImportSummary }
 */
export const importSchemesCsv: RequestHandler = async (req, res) => {
  // The route registers express.text() middleware, which populates req.body with
  // a string. Guard against missing or over-size bodies.
  if (typeof req.body !== "string" || !req.body.trim()) {
    throw new AppError(400, "IMPORT_BODY_MISSING", "Request body must be a non-empty CSV text.");
  }

  const byteLength = Buffer.byteLength(req.body, "utf8");
  if (byteLength > IMPORT_MAX_BYTES) {
    throw new AppError(
      413,
      "IMPORT_FILE_TOO_LARGE",
      `CSV body exceeds the ${Math.round(IMPORT_MAX_BYTES / 1024 / 1024)} MB limit. Split the file and re-import.`,
    );
  }

  const summary = await importSchemesFromCsvText(req.body);
  res.status(200).json({ data: summary });
};
