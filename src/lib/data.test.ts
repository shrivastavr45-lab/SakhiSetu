import { describe, expect, it } from "vitest";
import { districtName, inr } from "./data";

describe("shared display helpers", () => {
  it("resolves district names from the configured district list", () => {
    expect(districtName("bhopal")).toEqual({ hi: "भोपाल", en: "Bhopal" });
  });

  it("keeps unknown district labels visible for admin-created values", () => {
    expect(districtName("unknown-district")).toEqual({ hi: "unknown-district", en: "unknown-district" });
  });

  it("formats rupee amounts using Indian digit grouping", () => {
    expect(inr(125000)).toBe("₹1,25,000");
  });
});
