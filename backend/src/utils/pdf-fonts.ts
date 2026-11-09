/**
 * PDF font selection utilities for SakhiSetu donation receipts.
 *
 * PDFKit has built-in support for the 14 standard PDF fonts (Helvetica,
 * Times-Roman, Courier, etc.) which are Latin-only. To render Devanagari
 * script (used in Hindi donor names, trust names and addresses) a
 * Unicode-capable TTF/OTF must be registered at document creation time.
 *
 * Bundled font: Noto Sans Devanagari (Regular and Bold) — free, OFL-licensed,
 * covers the full Devanagari Unicode block including half-forms and conjuncts.
 * Located at backend/fonts/NotoSansDevanagari-Regular.ttf and
 * backend/fonts/NotoSansDevanagari-Bold.ttf.
 *
 * Set PDF_FONT_PATH to the path of a custom TTF to override the bundled font.
 * If omitted and Devanagari content is present, the bundled font is used automatically.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";

export type PdfFontConfig = {
  /** True when a custom TTF is registered and should be used. */
  useCustomFont: boolean;
  /** PDFKit font name for regular-weight text. */
  regular: string;
  /** PDFKit font name for bold-weight text. */
  bold: string;
  /** Resolved file path for the regular font (empty string if using built-in Helvetica). */
  resolvedFontPath: string;
  /** Resolved file path for the bold font (empty string if using built-in Helvetica). */
  resolvedBoldPath: string;
};

/** Name under which the regular TTF is registered in the PDFKit document. */
export const PDF_FONT_REGULAR = "SakhiRegular";
/** Name under which the bold TTF is registered in the PDFKit document. */
export const PDF_FONT_BOLD = "SakhiBold";

/** Error codes returned by selectPdfFonts for the service to convert to AppError. */
export type PdfFontError =
  | { code: "PDF_FONT_NOT_FOUND"; path: string }
  | { code: "PDF_UNICODE_FONT_REQUIRED"; triggerString: string };

export type SelectPdfFontsOptions = {
  /** When true, disables the automatic fallback to the bundled font (for testing). */
  disableBundledFont?: boolean;
};

/**
 * Resolves paths to bundled Noto Sans Devanagari fonts if present on disk.
 * Checks relative to this module (development and compiled dist) and relative to cwd.
 */
export function getBundledFontPaths(): { regular: string; bold: string } | null {
  const candidates: Array<{ regular: string; bold: string }> = [];

  // 1. Relative to this module via import.meta.url
  // In dev:  backend/src/utils/pdf-fonts.ts -> ../../fonts/
  // In prod: backend/dist/utils/pdf-fonts.js -> ../../fonts/
  try {
    const regularUrl = new URL("../../fonts/NotoSansDevanagari-Regular.ttf", import.meta.url);
    const boldUrl = new URL("../../fonts/NotoSansDevanagari-Bold.ttf", import.meta.url);
    candidates.push({
      regular: fileURLToPath(regularUrl),
      bold: fileURLToPath(boldUrl),
    });
  } catch {
    // Ignore URL resolution failure if import.meta.url cannot be parsed
  }

  // 2. Relative to process.cwd() (repository root or backend root)
  candidates.push({
    regular: resolve(process.cwd(), "backend/fonts/NotoSansDevanagari-Regular.ttf"),
    bold: resolve(process.cwd(), "backend/fonts/NotoSansDevanagari-Bold.ttf"),
  });
  candidates.push({
    regular: resolve(process.cwd(), "fonts/NotoSansDevanagari-Regular.ttf"),
    bold: resolve(process.cwd(), "fonts/NotoSansDevanagari-Bold.ttf"),
  });

  for (const c of candidates) {
    if (existsSync(c.regular)) {
      return {
        regular: c.regular,
        bold: existsSync(c.bold) ? c.bold : c.regular,
      };
    }
  }

  return null;
}

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
 * @param options       Optional configuration (e.g. disableBundledFont for testing).
 * @returns `{ config: PdfFontConfig }` on success, `{ error: PdfFontError }` on failure.
 */
export function selectPdfFonts(
  strings: string[],
  fontPath: string = "",
  boldFontPath: string = "",
  options?: SelectPdfFontsOptions,
): { config: PdfFontConfig } | { error: PdfFontError } {
  const normalFont = fontPath.trim();
  const boldFont = boldFontPath.trim() || normalFont;

  // Validate explicitly configured paths when non-empty
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

  // If explicit custom font path was provided, use it
  if (normalFont) {
    return {
      config: {
        useCustomFont: true,
        regular: PDF_FONT_REGULAR,
        bold: PDF_FONT_BOLD,
        resolvedFontPath: normalFont,
        resolvedBoldPath: boldFont,
      },
    };
  }

  // No explicit font path provided:
  if (needsDevanagari) {
    // Attempt automatic fallback to bundled font
    const bundled = options?.disableBundledFont ? null : getBundledFontPaths();
    if (bundled) {
      return {
        config: {
          useCustomFont: true,
          regular: PDF_FONT_REGULAR,
          bold: PDF_FONT_BOLD,
          resolvedFontPath: bundled.regular,
          resolvedBoldPath: bundled.bold,
        },
      };
    }
    return { error: { code: "PDF_UNICODE_FONT_REQUIRED", triggerString: devanagariStr } };
  }

  // English-only with no custom font -> built-in Helvetica
  return {
    config: {
      useCustomFont: false,
      regular: "Helvetica",
      bold: "Helvetica-Bold",
      resolvedFontPath: "",
      resolvedBoldPath: "",
    },
  };
}

/**
 * Registers custom fonts in a PDFKit document using the font names from
 * selectPdfFonts(). Call this immediately after creating the PDFDocument,
 * before any text rendering.
 */
export function registerPdfFonts(
  doc: { registerFont(name: string, path: string): void },
  config: PdfFontConfig,
  fontPath: string = "",
  boldFontPath: string = "",
): void {
  if (!config.useCustomFont) return;
  const normalFont = fontPath.trim() || config.resolvedFontPath;
  const boldFont = boldFontPath.trim() || config.resolvedBoldPath || normalFont;
  doc.registerFont(PDF_FONT_REGULAR, normalFont);
  doc.registerFont(PDF_FONT_BOLD, boldFont);
}

export type ReceiptPdfData = {
  receiptNumber: string;
  generatedAt: Date;
  donationId: string;
  donorName: string;
  donorEmail: string;
  donorPan: string | null;
  amount: number | string | { toString(): string };
  frequency?: "MONTHLY" | "ONE_TIME" | string;
  campaignTitle: string;
  trustName: string;
  trustAddress: string;
  trustPan: string;
  trust80GRegistration: string;
  deploymentMode: string;
};

export type GenerateReceiptPdfResult = {
  buffer: Buffer;
  fontConfig: ReturnType<typeof selectPdfFonts>;
};

/**
 * Generates the binary PDF buffer for a donation receipt.
 *
 * Automatically resolves Devanagari Unicode fonts (Noto Sans Devanagari)
 * when Hindi/Devanagari characters are present, while preserving built-in
 * Helvetica for English-only content.
 */
export async function generateReceiptPdfBuffer(
  data: ReceiptPdfData,
  fontPath: string = "",
  boldFontPath: string = "",
  options?: SelectPdfFontsOptions,
): Promise<GenerateReceiptPdfResult> {
  const fontResult = selectPdfFonts(
    [data.donorName, data.trustName, data.trustAddress],
    fontPath,
    boldFontPath,
    options,
  );

  if ("error" in fontResult) {
    const error = new Error(fontResult.error.code) as Error & {
      code: string;
      details?: unknown;
    };
    error.code = fontResult.error.code;
    error.details = fontResult.error;
    throw error;
  }

  const fontConfig = fontResult.config;

  const doc = new PDFDocument({
    size: "A4",
    margin: 52,
    info: {
      Title: `SakhiSetu 80G preview ${data.receiptNumber}`,
      Author: data.trustName,
    },
  });

  registerPdfFonts(doc, fontConfig, fontPath, boldFontPath);
  const pdfFont = fontConfig.regular;
  const pdfBoldFont = fontConfig.bold;

  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc
    .font(pdfBoldFont)
    .fontSize(10)
    .fillColor("#a33f2c")
    .text("TEST / PREVIEW — NOT VALID FOR TAX CLAIMS", { align: "center" });
  doc.moveDown(1.2);
  doc.fillColor("#252525").fontSize(20).text(data.trustName, { align: "center" });
  doc.moveDown(0.3);
  doc.font(pdfFont).fontSize(10).text(data.trustAddress, { align: "center" });
  doc.moveDown(1.2);
  doc.strokeColor("#b9a99a").moveTo(52, doc.y).lineTo(543, doc.y).stroke();
  doc.moveDown(1.2);
  doc
    .font(pdfBoldFont)
    .fontSize(16)
    .text("Donation receipt and 80G certificate preview", { align: "center" });
  doc.moveDown(0.4);
  doc
    .font(pdfFont)
    .fontSize(9)
    .fillColor("#a33f2c")
    .text(
      "This is a simulated test transaction. No funds were collected. This document is not an official receipt or tax certificate.",
      { align: "center" },
    );
  doc.moveDown(1.5);

  const rows: [string, string][] = [
    ["Receipt number", data.receiptNumber],
    [
      "Receipt date",
      data.generatedAt.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
    ],
    ["Donation reference", data.donationId],
    ["Donor name", data.donorName],
    ["Donor email", data.donorEmail],
    ["Donor PAN", data.donorPan ?? "Not provided"],
    [
      "Donation amount",
      `INR ${Number(data.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
    ],
    [
      "Donation frequency",
      data.frequency === "MONTHLY" ? "Monthly intention (no recurring charge created)" : "One-time",
    ],
    ["Campaign", data.campaignTitle],
    ["Payment status", "SUCCEEDED — TEST MODE ONLY"],
    [
      "Trust PAN",
      data.deploymentMode === "demo" ? "[DEMO — NOT A REAL REGISTRATION]" : data.trustPan,
    ],
    [
      "Trust 80G registration",
      data.deploymentMode === "demo"
        ? "[DEMO — NOT A REAL REGISTRATION]"
        : data.trust80GRegistration,
    ],
  ];

  for (const [label, value] of rows) {
    const y = doc.y;
    doc.font(pdfBoldFont).fontSize(10).fillColor("#555555").text(label, 58, y, { width: 155 });
    doc.font(pdfFont).fontSize(10).fillColor("#222222").text(value, 220, y, { width: 320 });
    doc.moveDown(0.75);
  }

  doc.moveDown(1.2);
  doc.strokeColor("#b9a99a").moveTo(52, doc.y).lineTo(543, doc.y).stroke();
  doc.moveDown(1);
  doc
    .font(pdfBoldFont)
    .fontSize(10)
    .fillColor("#a33f2c")
    .text("DEMO DOCUMENT — DO NOT SUBMIT TO THE INCOME TAX DEPARTMENT", {
      align: "center",
    });
  doc.moveDown(0.5);
  doc
    .font(pdfFont)
    .fontSize(8)
    .fillColor("#555555")
    .text(
      "Trust PAN and registration fields are demo placeholders unless formally configured by the trust. Production issuance requires verification of trust registration, donor data, Form 10BD reporting, and applicable legal requirements.",
      { align: "left" },
    );
  doc.end();

  const buffer = await bufferPromise;
  return { buffer, fontConfig: fontResult };
}
