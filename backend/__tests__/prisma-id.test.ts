import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @prisma/client before importing the module under test ────────────
vi.mock("@prisma/client", () => ({
  Prisma: {
    dmmf: {
      datamodel: {
        models: [
          {
            name: "User",
            fields: [{ name: "id", type: "BigInt" }],
          },
          {
            name: "WardrobeItem",
            fields: [
              { name: "id", type: "BigInt" },
              { name: "userId", type: "BigInt" },
            ],
          },
          {
            name: "DailyCuration",
            fields: [
              { name: "id", type: "BigInt" },
              { name: "userId", type: "BigInt" },
            ],
          },
          {
            name: "StringIdModel",
            fields: [{ name: "id", type: "String" }],
          },
        ],
      },
    },
  },
}));

// ── Mock snowflake for deterministic IDs ──────────────────────────────────
vi.mock("@/backend/database/snowflake", () => ({
  generateSnowflakeId: vi.fn(() => BigInt("1000000000000000001")),
}));

import { toPrismaId, generatePrismaId } from "@/backend/database/prisma-id";

describe("toPrismaId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when the field type is BigInt", () => {
    it("returns a bigint for a string input", () => {
      const result = toPrismaId("User", "id", "12345");
      expect(typeof result).toBe("bigint");
      expect(result).toBe(BigInt("12345"));
    });

    it("returns a bigint for a number input", () => {
      const result = toPrismaId("User", "id", 99);
      expect(typeof result).toBe("bigint");
      expect(result).toBe(BigInt(99));
    });

    it("returns the same bigint for bigint input", () => {
      const result = toPrismaId("User", "id", BigInt("42"));
      expect(result).toBe(BigInt("42"));
    });

    it("works for WardrobeItem userId (BigInt field)", () => {
      const result = toPrismaId("WardrobeItem", "userId", "777");
      expect(result).toBe(BigInt("777"));
    });
  });

  describe("when the field type is String", () => {
    it("returns a string for a numeric string input", () => {
      const result = toPrismaId("StringIdModel", "id", "789");
      expect(typeof result).toBe("string");
      expect(result).toBe("789");
    });

    it("returns the numeric string representation for a number input", () => {
      const result = toPrismaId("StringIdModel", "id", 5);
      expect(typeof result).toBe("string");
      expect(result).toBe("5");
    });

    it("returns a string for bigint input", () => {
      const result = toPrismaId("StringIdModel", "id", BigInt("900"));
      expect(typeof result).toBe("string");
      expect(result).toBe("900");
    });
  });

  describe("unknown model / field — defaults to BigInt", () => {
    it("falls back to BigInt for an unknown model", () => {
      const result = toPrismaId("UnknownModel", "id", "55");
      expect(typeof result).toBe("bigint");
      expect(result).toBe(BigInt("55"));
    });
  });
});

describe("generatePrismaId", () => {
  it("returns a value derived from the snowflake generator", () => {
    const result = generatePrismaId("User");
    // Mocked snowflake returns BigInt("1000000000000000001")
    // User.id is BigInt → result should be BigInt
    expect(typeof result).toBe("bigint");
    expect(result).toBe(BigInt("1000000000000000001"));
  });

  it("returns a string for a String-type id model", () => {
    const result = generatePrismaId("StringIdModel");
    expect(typeof result).toBe("string");
    expect(result).toBe("1000000000000000001");
  });
});
