/**
 * POST /api/auth/dev-login
 *
 * DEV ONLY — skips authentication and returns a valid JWT for a persistent
 * dev user. Returns 403 in production. Only usable when NODE_ENV=development.
 */

import prisma from "@/backend/database/prisma";
import {
    generateAccessToken,
    generateRefreshToken,
    setRefreshTokenCookie,
} from "@/backend/database/jwt";
import { successResponse, errorResponse } from "@/backend/database/api-response";
import { generatePrismaId, toPrismaId } from "@/backend/database/prisma-id";
import bcrypt from "bcryptjs";
import type { AuthPayload } from "@/types/api";

export async function POST() {
    if (process.env.NODE_ENV !== "development") {
        return errorResponse("Not available in production", 403);
    }

    const devEmail = "dev@altfit.local";

    // Upsert dev user so all downstream API routes work normally
    const user = await prisma.user.upsert({
        where: { email: devEmail },
        update: {},
        create: {
            id: generatePrismaId("User") as never,
            email: devEmail,
            name: "Dev User",
            provider: "dev",
            onboarded: true,
        },
    });

    const payload = {
        userId: user.id.toString(),
        email: user.email,
        provider: user.provider,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Store refresh token in database (hashed)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 2);
    await prisma.session.create({
        data: {
            id: generatePrismaId("Session") as never,
            userId: toPrismaId("Session", "userId", user.id) as never,
            token: refreshTokenHash,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
    });

    const response = successResponse<AuthPayload>(
        {
            accessToken,
            user: {
                id: user.id.toString(),
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                provider: user.provider,
                onboarded: user.onboarded,
            },
        },
        "Dev login successful",
        200,
    );

    setRefreshTokenCookie(response, refreshToken);
    return response;
}
