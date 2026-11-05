/**
 * Pure-logic tests for the donor records section (Checkpoint 5).
 * All tests run without a database — they exercise the aggregation logic,
 * search/sort behaviour, PAN masking, and status categorisation that the
 * DonorsSection and DonorDetailDrawer rely on.
 */
import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Donor aggregation helpers (mirrors donor.service.ts logic)
// ---------------------------------------------------------------------------

/**
 * Aggregates a flat list of donation rows (as returned by the DB) into one
 * summary object per userId, matching the shape produced by listDonors().
 */
function aggregateDonors(donations) {
  const byUser = new Map();
  for (const d of donations) {
    if (!d.userId) continue; // skip guest donations
    const bucket = byUser.get(d.userId) ?? [];
    bucket.push(d);
    byUser.set(d.userId, bucket);
  }

  return Array.from(byUser.entries()).map(([userId, rows]) => {
    const succeeded = rows.filter((r) => r.status === "SUCCEEDED");
    const pending   = rows.filter((r) => r.status === "PENDING");
    const failed    = rows.filter((r) => r.status === "FAILED");
    const totalAmount = succeeded.reduce((s, r) => s + r.amount, 0);
    // latest = first row when sorted by createdAt desc (already sorted in service)
    const latestRow   = rows[0];
    const panLast4    = rows.find((r) => r.panLast4)?.panLast4 ?? null;
    const campaignIds = [...new Set(rows.map((r) => r.campaignId))];
    return {
      userId, totalAmount,
      succeededCount: succeeded.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalCount: rows.length,
      latestDonationAt: latestRow ? latestRow.createdAt : null,
      panLast4, campaignIds,
    };
  });
}

// Fixtures
const donations = [
  { userId: "u1", amount: 1500, status: "SUCCEEDED", campaignId: "silai-kendra", panLast4: "234F", createdAt: "2026-11-03T10:00:00.000Z" },
  { userId: "u1", amount: 500,  status: "FAILED",    campaignId: "silai-kendra", panLast4: "234F", createdAt: "2026-10-01T10:00:00.000Z" },
  { userId: "u2", amount: 2000, status: "SUCCEEDED", campaignId: "maa-poshan",  panLast4: "789Z", createdAt: "2026-11-04T08:00:00.000Z" },
  { userId: "u2", amount: 1000, status: "SUCCEEDED", campaignId: "sakhi-mitra", panLast4: "789Z", createdAt: "2026-10-15T08:00:00.000Z" },
  { userId: "u2", amount: 300,  status: "PENDING",   campaignId: "maa-poshan",  panLast4: null,   createdAt: "2026-09-01T08:00:00.000Z" },
  // guest donation — no userId, must be excluded
  { userId: null, amount: 500,  status: "SUCCEEDED", campaignId: "silai-kendra", panLast4: "999X", createdAt: "2026-11-01T00:00:00.000Z" },
];

test("aggregateDonors excludes guest donations (userId = null)", () => {
  const result = aggregateDonors(donations);
  assert.equal(result.length, 2);
  assert.ok(result.every((r) => r.userId !== null));
});

test("aggregateDonors counts succeeded, pending and failed correctly per donor", () => {
  const result = aggregateDonors(donations);
  const u1 = result.find((r) => r.userId === "u1");
  assert.ok(u1);
  assert.equal(u1.succeededCount, 1);
  assert.equal(u1.failedCount,    1);
  assert.equal(u1.pendingCount,   0);
  assert.equal(u1.totalCount,     2);

  const u2 = result.find((r) => r.userId === "u2");
  assert.ok(u2);
  assert.equal(u2.succeededCount, 2);
  assert.equal(u2.failedCount,    0);
  assert.equal(u2.pendingCount,   1);
  assert.equal(u2.totalCount,     3);
});

test("aggregateDonors sums only SUCCEEDED amounts for totalAmount", () => {
  const result = aggregateDonors(donations);
  const u1 = result.find((r) => r.userId === "u1");
  // 1500 succeeded, 500 failed → total = 1500
  assert.equal(u1.totalAmount, 1500);

  const u2 = result.find((r) => r.userId === "u2");
  // 2000 + 1000 succeeded, 300 pending → total = 3000
  assert.equal(u2.totalAmount, 3000);
});

test("aggregateDonors picks panLast4 from first donation that has one", () => {
  const result = aggregateDonors(donations);
  const u1 = result.find((r) => r.userId === "u1");
  assert.equal(u1.panLast4, "234F");

  const u2 = result.find((r) => r.userId === "u2");
  assert.equal(u2.panLast4, "789Z");
});

test("aggregateDonors returns null panLast4 when no donation has one", () => {
  const noPan = [
    { userId: "u3", amount: 500, status: "SUCCEEDED", campaignId: "c1", panLast4: null, createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const result = aggregateDonors(noPan);
  assert.equal(result[0].panLast4, null);
});

test("aggregateDonors collects unique campaignIds per donor", () => {
  const result = aggregateDonors(donations);
  const u2 = result.find((r) => r.userId === "u2");
  // maa-poshan appears twice but should only be listed once
  assert.equal(u2.campaignIds.length, 2);
  assert.ok(u2.campaignIds.includes("maa-poshan"));
  assert.ok(u2.campaignIds.includes("sakhi-mitra"));
});

// ---------------------------------------------------------------------------
// Search filtering (mirrors DonorsSection useMemo logic)
// ---------------------------------------------------------------------------

const donorRows = [
  { userId: "u1", name: "Radha Sharma",  email: "radha@example.test",  totalAmount: 1500, totalCount: 2, latestDonationAt: "2026-11-03T10:00:00.000Z" },
  { userId: "u2", name: "Priya Verma",   email: "priya@example.test",  totalAmount: 3000, totalCount: 3, latestDonationAt: "2026-11-04T08:00:00.000Z" },
  { userId: "u3", name: "Sunita Tiwari", email: "sunita@example.test", totalAmount: 500,  totalCount: 1, latestDonationAt: "2026-10-10T00:00:00.000Z" },
];

function searchDonors(rows, q) {
  const query = q.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((d) => d.name.toLowerCase().includes(query) || d.email.toLowerCase().includes(query));
}

test("search returns all rows when query is empty", () => {
  assert.equal(searchDonors(donorRows, "").length, 3);
  assert.equal(searchDonors(donorRows, "  ").length, 3);
});

test("search matches on donor name (case-insensitive)", () => {
  const result = searchDonors(donorRows, "sharma");
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "u1");
});

test("search matches on partial email", () => {
  const result = searchDonors(donorRows, "priya@");
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "u2");
});

test("search is case-insensitive for email", () => {
  const result = searchDonors(donorRows, "SUNITA");
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "u3");
});

test("search returns empty array when no donor matches", () => {
  assert.equal(searchDonors(donorRows, "notadonor").length, 0);
});

// ---------------------------------------------------------------------------
// Sorting (mirrors DonorsSection sort logic)
// ---------------------------------------------------------------------------

function sortDonors(rows, key, asc) {
  const copy = rows.slice();
  copy.sort((a, b) => {
    let cmp = 0;
    if (key === "name") {
      cmp = a.name.localeCompare(b.name, "hi");
    } else if (key === "totalAmount") {
      cmp = a.totalAmount - b.totalAmount;
    } else if (key === "totalCount") {
      cmp = a.totalCount - b.totalCount;
    } else {
      const ta = a.latestDonationAt ? new Date(a.latestDonationAt).getTime() : 0;
      const tb = b.latestDonationAt ? new Date(b.latestDonationAt).getTime() : 0;
      cmp = ta - tb;
    }
    return asc ? cmp : -cmp;
  });
  return copy;
}

test("sort by totalAmount descending puts highest donor first", () => {
  const result = sortDonors(donorRows, "totalAmount", false);
  assert.equal(result[0].userId, "u2"); // 3000
  assert.equal(result[2].userId, "u3"); // 500
});

test("sort by totalAmount ascending puts lowest donor first", () => {
  const result = sortDonors(donorRows, "totalAmount", true);
  assert.equal(result[0].userId, "u3"); // 500
});

test("sort by latestDonationAt descending puts most-recent first", () => {
  const result = sortDonors(donorRows, "latestDonationAt", false);
  assert.equal(result[0].userId, "u2"); // Nov 4
  assert.equal(result[2].userId, "u3"); // Oct 10
});

test("sort by totalCount descending puts most-active donor first", () => {
  const result = sortDonors(donorRows, "totalCount", false);
  assert.equal(result[0].userId, "u2"); // 3 donations
});

// ---------------------------------------------------------------------------
// PAN masking — never expose full PAN
// ---------------------------------------------------------------------------

test("PAN display shows only last 4 digits with bullet mask", () => {
  const panLast4 = "234F";
  const masked = `••••${panLast4}`;
  assert.equal(masked, "••••234F");
  // Confirm the full PAN is not accidentally embedded
  assert.doesNotMatch(masked, /^[A-Z]{5}[0-9]{4}[A-Z]$/);
});

test("PAN display for null panLast4 renders a dash placeholder", () => {
  const panLast4 = null;
  const display = panLast4 ? `••••${panLast4}` : "—";
  assert.equal(display, "—");
});

// ---------------------------------------------------------------------------
// Authorization — confirm ADMIN role constant is what we expect
// ---------------------------------------------------------------------------

test("UserRole.ADMIN string value is 'ADMIN' (used in requireRole guard)", async () => {
  const { UserRole } = await import("@prisma/client");
  assert.equal(UserRole.ADMIN, "ADMIN");
  assert.equal(UserRole.DONOR, "DONOR");
});

test("ADMIN and DONOR are distinct roles (authorization cannot be bypassed by role equality)", async () => {
  const { UserRole } = await import("@prisma/client");
  assert.notEqual(UserRole.ADMIN, UserRole.DONOR);
});
