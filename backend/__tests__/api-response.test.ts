/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock next/server before importing the module under test ──────────────
vi.mock("next/server", () => {
  class MockNextResponse {
    _body: string;
    _init: { status?: number; headers?: Record<string, string> } | undefined;

    constructor(
      body: string,
      init?: { status?: number; headers?: Record<string, string> },
    ) {
      this._body = body;
      this._init = init;
    }

    get status(): number {
      return this._init?.status ?? 200;
    }

    async json(): Promise<unknown> {
      return JSON.parse(this._body);
    }

    static json(
      data: unknown,
      init?: { status?: number; headers?: Record<string, string> },
    ): MockNextResponse {
      return new MockNextResponse(JSON.stringify(data), init);
    }
  }

  return { NextResponse: MockNextResponse };
});

import {
  successResponse,
  errorResponse,
} from "@/backend/database/api-response";

describe("successResponse", () => {
  it("sets success: true", async () => {
    const res = successResponse({ id: "1" });
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("nests the payload under data", async () => {
    const payload = { id: "abc", name: "Test" };
    const res = successResponse(payload);
    const body = await res.json();
    expect(body.data).toEqual(payload);
  });

  it("uses the provided message", async () => {
    const res = successResponse({}, "Item created");
    const body = await res.json();
    expect(body.message).toBe("Item created");
  });

  it("defaults to HTTP 200", () => {
    const res = successResponse({});
    expect(res.status).toBe(200);
  });

  it("respects the provided status code", () => {
    const res = successResponse({}, "Created", 201);
    expect(res.status).toBe(201);
  });

  it("serialises BigInt values as strings", async () => {
    const res = successResponse({ id: BigInt("9007199254740993") });
    const body = await res.json();
    // BigInt serialised to string — deserialised JSON will have a string
    expect(body.data.id).toBe("9007199254740993");
  });
});

describe("errorResponse", () => {
  it("sets success: false", async () => {
    const res = errorResponse("Something went wrong");
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("includes the error message string", async () => {
    const res = errorResponse("Missing field");
    const body = await res.json();
    expect(body.error).toBe("Missing field");
  });

  it("unwraps an Error object's message", async () => {
    const res = errorResponse(new Error("DB connection failed"));
    const body = await res.json();
    expect(body.error).toBe("DB connection failed");
  });

  it("defaults to HTTP 400", () => {
    const res = errorResponse("bad");
    expect(res.status).toBe(400);
  });

  it("respects the provided status code", () => {
    const res = errorResponse("Not found", 404);
    expect(res.status).toBe(404);
  });

  it("respects 429 rate-limit status", () => {
    const res = errorResponse("Too many requests", 429);
    expect(res.status).toBe(429);
  });

  it("respects 500 server error status", () => {
    const res = errorResponse("Internal error", 500);
    expect(res.status).toBe(500);
  });
});
