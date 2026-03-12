/**
 * AI Clothing Classification Endpoint
 * Safely calls Anthropic API from backend to classify clothing items from images
 * Prevents CORS issues by handling API communication server-side
 */

import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const MAX_RETRIES = 3;
const RETRY_DELAY = 2200; // milliseconds

/**
 * Logs structured error information
 */
function logError(context, error, metadata = {}) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR in ${context}:`, {
        message: error?.message || error,
        metadata,
        stack: error?.stack,
    });
}

/**
 * Logs structured success information
 */
function logSuccess(context, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] SUCCESS in ${context}:`, {
        message,
        metadata,
    });
}

/**
 * Attempts to parse JSON from various formats in the response
 */
function parseJsonFromResponse(raw) {
    try {
        // Try matching JSON array first
        const arrMatch = raw.match(/\[[\s\S]*\]/);
        if (arrMatch) {
            return JSON.parse(arrMatch[0]);
        }

        // Try matching JSON object
        const objMatch = raw.match(/\{[\s\S]*\}/);
        if (objMatch) {
            return [JSON.parse(objMatch[0])];
        }

        throw new Error("No valid JSON structure found in response");
    } catch (err) {
        logError("parseJsonFromResponse", err, { raw: raw.substring(0, 200) });
        throw new Error(`Failed to parse AI response: ${err.message}`);
    }
}

/**
 * Calls Anthropic API with retry logic for rate limiting
 */
async function callAnthropicAPI(messageContent, attempt = 0) {
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
            },
            body: JSON.stringify({
                model: MODEL,
                max_tokens: 2000,
                messages: [{ role: "user", content: messageContent }],
            }),
        });

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
            if (attempt < MAX_RETRIES - 1) {
                const waitTime = RETRY_DELAY * (attempt + 1);
                logError("callAnthropicAPI", "Rate limited, retrying...", {
                    attempt: attempt + 1,
                    waitMs: waitTime,
                });
                await new Promise((resolve) => setTimeout(resolve, waitTime));
                return callAnthropicAPI(messageContent, attempt + 1);
            }
            throw new Error(
                "Rate limit reached. Please wait a few minutes before trying again."
            );
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => response.statusText);
            throw new Error(
                `Anthropic API Error ${response.status}: ${errorBody.substring(0, 200)}`
            );
        }

        const data = await response.json();
        if (data.error) {
            throw new Error(`Anthropic API Error: ${data.error.message || JSON.stringify(data.error)}`);
        }

        return data;
    } catch (error) {
        logError("callAnthropicAPI", error, {
            attempt,
            model: MODEL,
        });
        throw error;
    }
}

/**
 * POST /api/classify-clothing
 * Classifies clothing items from a base64-encoded image
 */
export async function POST(request) {
    const startTime = Date.now();

    try {
        // Validate environment
        if (!ANTHROPIC_API_KEY) {
            logError("POST /api/classify-clothing", "Missing ANTHROPIC_API_KEY environment variable");
            return NextResponse.json(
                { error: "Server configuration error: Missing API key" },
                { status: 500 }
            );
        }

        const { base64, mediaType } = await request.json();

        // Validate request
        if (!base64 || typeof base64 !== "string") {
            return NextResponse.json(
                { error: "Invalid request: missing or invalid base64 image data" },
                { status: 400 }
            );
        }

        if (!mediaType || typeof mediaType !== "string") {
            return NextResponse.json(
                { error: "Invalid request: missing or invalid mediaType" },
                { status: 400 }
            );
        }

        logSuccess("POST /api/classify-clothing", "Request received", {
            mediaType,
            imageSize: base64.length,
        });

        // Create message content with image
        const messageContent = [
            {
                type: "image",
                source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64,
                },
            },
            {
                type: "text",

                text: `Identify every distinct clothing item and accessory in this image. Return ONLY a JSON array, no markdown:
[{"name":"...","category":"top|bottom|dress|outerwear|footwear|bag|accessory","type":"...","colorName":"...","colorHex":"...","pattern":"Solid|Striped|Printed|Textured|Embellished","fit":"Fitted|Relaxed|Oversized|Cropped|Longline","formality":"Casual|Smart Casual|Formal|Festive","season":"Summer|Winter|Transitional|All-Season","note":"One stylist sentence.","pairsWith":["item1","item2","item3"],"emoji":"..."}]
Rules: one object per garment, return ONLY the JSON array, no other text.`,
            },
        ];

        // Call Anthropic API
        const data = await callAnthropicAPI(messageContent);

        // Parse response
        const raw = (data.content || [])
            .map((c) => c.text || "")
            .join("")
            .trim();

        const cleaned = raw.replace(/```json|```/g, "").trim();
        const items = parseJsonFromResponse(cleaned);

        // Validate response
        if (!Array.isArray(items) || items.length === 0) {
            logError("POST /api/classify-clothing", "Invalid AI response format");
            return NextResponse.json(
                { error: "AI returned no clothing items. Please try a clearer image." },
                { status: 400 }
            );
        }

        logSuccess("POST /api/classify-clothing", "Successfully classified items", {
            itemCount: items.length,
            processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({ items }, { status: 200 });
    } catch (error) {
        logError("POST /api/classify-clothing", error, {
            processingTimeMs: Date.now() - startTime,
        });

        // Return appropriate error response
        const statusCode = error.message.includes("Rate limit")
            ? 429
            : error.message.includes("Invalid request")
                ? 400
                : 500;

        return NextResponse.json(
            {
                error: error.message || "Failed to classify clothing",
            },
            { status: statusCode }
        );
    }
}
