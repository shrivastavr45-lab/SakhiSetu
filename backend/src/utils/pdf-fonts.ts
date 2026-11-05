/**
 * PDF font selection utilities for SakhiSetu donation receipts.
 *
 * PDFKit has built-in support for the 14 standard PDF fonts (Helvetica,
 * Times-Roman, Courier, etc.) which are Latin-only. To render Devanagari
 * script (used in Hindi donor names, trust names and addresses) a
 * Unicode-capable TTF/OTF must be registered at document creation time.
 *
 * Recommended font: Noto Sans Devanagari — free, OFL-licensed, covers the
 * full Devanagari Unicode block including half-forms and conjuncts.
 * Download: https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari
 *
 * Set PDF_FONT_PATH to the absolute path of the regular-weight TTF.
 * Optionally set PDF_FONT_BOLD_PATH for a bold-weight TTF; if omitted the
 * regular font is used for both weights (acceptable for most Devanagari
 * typefaces which render visually at a consistent weight in PDFs).
 */

import { existsSync } from "node:fs";

export type PdfFontConfig = {
  /** True when a custom TTF is registered and should be used. */
  useCustomFont: boolean;
  /** PDFKit font name for regular-weight text. */
  regular: string;
  /** PDFKit font name for bold-weight text. */
  bold: string;
};

/** Name under which the regular TTF is registered in the PDFKit document. */
export const PDF_FONT_REGULAR = "SakhiRegular";
/** Name under which the bold TTF is registered in the PDFKit document. */
export const PDF_FONT_BOLD = "SakhiBold";

/** Error codes returned by selectPdfFonts for the service to convert to AppError. */
export type PdfFontError =
  | { code: "PDF_FONT_NOT_FOUND"; path: string }
  | { code: "PDF_UNICODE_FONT_REQUIRED"; triggerString: string };

/**
 * Decides which font stack to use for a receipt PDF and validates that
 * required font files are present.
 *
 * Returns a `{ error }` discriminant rather than throwing so that this module
 * has no dependency on AppError (which pulls in env.ts and cannot be imported
 * in tests that run without dotenv).
 *
 * @param strings       All text strings that will appear in the PDF.
 * @param fontPath      Value of env.PDF_FONT_PATH (may be empty string).
 * @param boldFontPath  Value of env.PDF_FONT_BOLD_PATH (may be empty string).
 * @returns `{ config: PdfFontConfig }` on success, `{ error: PdfFontError }` on failure.
 */
export function selectPdfFonts(
  strings: string[],
  fontPath: string,
  boldFontPath: string,
): { config: PdfFontConfig } | { error: PdfFontError } {
  const normalFont = fontPath.trim();
  const boldFont   = boldFontPath.trim() || normalFont;

  // Validate paths when non-empty
  if (normalFont && !existsSync(normalFont)) {
    return { error: { code: "PDF_FONT_NOT_FOUND", path: normalFont } };
  }
  if (boldFont && boldFont !== normalFont && !existsSync(boldFont)) {
    return { error: { code: "PDF_FONT_NOT_FOUND", path: boldFont } };
  }

  // Check whether any string contains Devanagari script
  const devanagariRe = /\p{Script=Devanagari}/u;
  const devanagariStr = strings.find((s) => devanagariRe.test(s));
  const needsDevanagari = devanagariStr !== undefined;

  if (needsDevanagari && !normalFont) {
    return { error: { code: "PDF_UNICODE_FONT_REQUIRED", triggerString: devanagariStr } };
  }

  if (!normalFont) {
    return { config: { useCustomFont: false, regular: "Helvetica", bold: "Helvetica-Bold" } };
  }

  return { config: { useCustomFont: true, regular: PDF_FONT_REGULAR, bold: PDF_FONT_BOLD } };
}

/**
 * Registers custom fonts in a PDFKit document using the font names from
 * selectPdfFonts(). Call this immediately after creating the PDFDocument,
 * before any text rendering.
 */
export function registerPdfFonts(
  // Using unknown here avoids importing the PDFKit type which requires the
  // compiled declaration files unavailable during strip-types test runs.
  doc: { registerFont(name: string, path: string): void },
  config: PdfFontConfig,
  fontPath: string,
  boldFontPath: string,
): void {
  if (!config.useCustomFont) return;
  const normalFont = fontPath.trim();
  const boldFont   = boldFontPath.trim() || normalFont;
  doc.registerFont(PDF_FONT_REGULAR, normalFont);
  doc.registerFont(PDF_FONT_BOLD, boldFont);
}
