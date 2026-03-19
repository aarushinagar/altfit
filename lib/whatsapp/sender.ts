/**
 * WhatsApp Message Sender
 *
 * Integration point for WhatsApp Business API (via ThingyG, Twilio, or direct API).
 * Currently stubbed for local development.
 *
 * To integrate with a real WhatsApp provider:
 * 1. Add WHATSAPP_API_KEY or TWILIO_ACCOUNT_SID to env
 * 2. Implement actual HTTP calls to provider API
 * 3. Handle rate limiting and retry logic
 */

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  phoneNumber: string;
  error?: string;
}

/**
 * Send a WhatsApp message to a user
 * @param toPhone E.164 formatted phone (e.g., +919876543210)
 * @param message Plain text message (up to 4096 chars)
 * @returns Result with messageId if successful
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  message: string,
): Promise<WhatsAppSendResult> {
  try {
    // Validate phone format
    if (!/^\+\d{10,}$/.test(toPhone)) {
      return {
        success: false,
        phoneNumber: toPhone,
        error: "Invalid phone format. Expected E.164: +919876543210",
      };
    }

    // Validate message length
    if (!message.trim()) {
      return {
        success: false,
        phoneNumber: toPhone,
        error: "Message cannot be empty",
      };
    }

    if (message.length > 4096) {
      return {
        success: false,
        phoneNumber: toPhone,
        error: "Message exceeds 4096 character limit",
      };
    }

    // TODO: Implement actual WhatsApp API call based on provider
    // For now, log and return success for testing
    console.log(
      `[WhatsApp] Would send to ${toPhone}: "${message.substring(0, 100)}..."`,
    );

    return {
      success: true,
      messageId: `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      phoneNumber: toPhone,
    };
  } catch (err) {
    console.error(
      `[WhatsApp] Failed to send to ${toPhone}:`,
      err instanceof Error ? err.message : String(err),
    );
    return {
      success: false,
      phoneNumber: toPhone,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Send WhatsApp messages in batch (with rate limiting)
 */
export async function sendWhatsAppBatch(
  messages: Array<{ to: string; message: string }>,
  delayMs = 100,
): Promise<WhatsAppSendResult[]> {
  const results: WhatsAppSendResult[] = [];

  for (const { to, message } of messages) {
    const result = await sendWhatsAppMessage(to, message);
    results.push(result);

    // Rate limiting: wait between messages
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Example WhatsApp API integration (Twilio)
 *
 * async function sendViaTwilio(toPhone: string, message: string) {
 *   const accountSid = process.env.TWILIO_ACCOUNT_SID;
 *   const authToken = process.env.TWILIO_AUTH_TOKEN;
 *   const fromPhone = process.env.TWILIO_WHATSAPP_NUMBER;
 *
 *   if (!accountSid || !authToken || !fromPhone) {
 *     throw new Error("Twilio credentials not configured");
 *   }
 *
 *   const client = new twilio(accountSid, authToken);
 *   const response = await client.messages.create({
 *     from: `whatsapp:${fromPhone}`,
 *     to: `whatsapp:${toPhone}`,
 *     body: message,
 *   });
 *
 *   return {
 *     success: true,
 *     messageId: response.sid,
 *     phoneNumber: toPhone,
 *   };
 * }
 */

/**
 * Example WhatsApp API integration (WhatsApp Business API via HTTP)
 *
 * async function sendViaWhatsAppBusinessAPI(toPhone: string, message: string) {
 *   const apiKey = process.env.WHATSAPP_API_KEY;
 *   const businessPhone = process.env.WHATSAPP_BUSINESS_PHONE_ID;
 *
 *   if (!apiKey || !businessPhone) {
 *     throw new Error("WhatsApp API credentials not configured");
 *   }
 *
 *   const response = await fetch(
 *     `https://graph.instagram.com/v18.0/${businessPhone}/messages`,
 *     {
 *       method: "POST",
 *       headers: {
 *         "Authorization": `Bearer ${apiKey}`,
 *         "Content-Type": "application/json",
 *       },
 *       body: JSON.stringify({
 *         messaging_product: "whatsapp",
 *         to: toPhone,
 *         type: "text",
 *         text: { body: message },
 *       }),
 *     }
 *   );
 *
 *   if (!response.ok) {
 *     throw new Error(`WhatsApp API error: ${response.statusText}`);
 *   }
 *
 *   const data = await response.json();
 *   return {
 *     success: true,
 *     messageId: data.messages[0].id,
 *     phoneNumber: toPhone,
 *   };
 * }
 */
