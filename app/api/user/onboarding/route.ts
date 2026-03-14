import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  getAuthenticatedUserId,
  authenticateRequest,
} from "@/lib/auth-middleware";
import {
  successResponse,
  errorResponse,
  validateRequired,
} from "@/lib/api-response";

const VALID_STYLE_PROFILES = [
  "minimalist",
  "classic",
  "bohemian",
  "streetwear",
  "preppy",
  "romantic",
  "edgy",
  "athleisure",
  "business-casual",
  "eclectic",
];

/**
 * POST /api/user/onboarding
 * Save style profile selections and mark user as onboarded.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = authenticateRequest(request);
    if (authError) return authError;

    const userId = getAuthenticatedUserId(request);
    const body = await request.json().catch(() => ({}));

    const validation = validateRequired(body, ["styleProfiles"]);
    if (validation) return validation;

    const { styleProfiles, styleIssues = [] } = body as {
      styleProfiles: string[];
      styleIssues?: string[];
    };

    if (!Array.isArray(styleProfiles) || styleProfiles.length === 0) {
      return errorResponse("styleProfiles must be a non-empty array", 400);
    }

    const invalidProfiles = styleProfiles.filter(
      (p) => !VALID_STYLE_PROFILES.includes(p),
    );
    if (invalidProfiles.length > 0) {
      return errorResponse(
        `Invalid style profiles: ${invalidProfiles.join(", ")}. Valid options: ${VALID_STYLE_PROFILES.join(", ")}`,
        400,
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        styleProfiles,
        styleIssues: Array.isArray(styleIssues) ? styleIssues : [],
        onboarded: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        provider: true,
        styleProfiles: true,
        styleIssues: true,
        onboarded: true,
      },
    });

    console.log(`[user/onboarding] User ${userId} onboarded`);
    return successResponse(user, "Onboarding complete", 200);
  } catch (error) {
    console.error("[user/onboarding] Error:", error);
    return errorResponse(error instanceof Error ? error.message : "Onboarding failed", 500);
  }
}
