---
applyTo: "__tests__/**,jest.config.ts,jest.setup.ts"
---

# ALTFit — Testing

## Setup

Install: `npm install --save-dev jest @jest/globals ts-jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`

## jest.config.ts

```typescript
import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["**/__tests__/api/**/*.test.ts", "**/__tests__/lib/**/*.test.ts"],
      transform: { "^.+\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
    },
    {
      displayName: "jsdom",
      testEnvironment: "jest-environment-jsdom",
      testMatch: ["**/__tests__/components/**/*.test.tsx"],
      transform: { "^.+\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
      moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
    },
  ],
};

export default config;
```

## jest.setup.ts

```typescript
import "@testing-library/jest-dom";
```

## Required Mocks for API Route Tests

```typescript
jest.mock("@/backend/database/prisma", () => ({
  __esModule: true,
  default: {
    wardrobeItem: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
    session: { create: jest.fn(), deleteMany: jest.fn() },
    outfit: { create: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock("@/backend/database/auth-middleware", () => ({
  authenticateRequest: jest.fn().mockReturnValue(null),
  getAuthenticatedUserId: jest.fn().mockReturnValue("test-user-id"),
}));
```

## Test Structure

```
__tests__/
  api/          Route handler tests (node environment)
    auth/
    wardrobe/
    outfits/
    curations/
  lib/           Utility and schema tests
    schemas/
    tools/
  components/    Component tests (jsdom environment)
    today/
    wardrobe/
    upload/
```

## What to Test

- API routes: auth guard enforcement, user isolation, validation errors, happy path
- Zod schemas: valid + invalid inputs for `wardrobeItemMetadataSchema`, `curationOutputSchema`
- LangGraph nodes: mock Gemini/Prisma, verify state transitions
- Never test internal MUI component details — test user-visible behavior
