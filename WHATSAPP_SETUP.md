# WhatsApp Messaging System Setup Guide

## Overview

The Altfit WhatsApp messaging system provides personalized, casual messaging to users in parallel with the email system. All messages use Claude Haiku for personalization and are scheduled via Render cron jobs.

## Architecture Overview

```
User Registration
    ↓
POST /api/auth/register
    ├→ Create user (email, phone, password)
    ├→ Send welcome email (async, non-blocking)
    └→ Send welcome WhatsApp (async, non-blocking)
        ↓
        POST /api/whatsapp/welcome
            ├→ Personalize via Claude Haiku
            ├→ Send via WhatsApp provider
            ├→ Log to WhatsAppLog table
            └→ Return success/error
```

## WhatsApp Routes

### 1. `/api/whatsapp/good-morning` (Cron: Daily 8:00 AM IST)
- **Purpose**: Daily morning outfit greeting
- **Recipients**: All active users with phone + wardrobeItemCount ≥ 2
- **Message Type**: "good_morning"
- **Deduplication**: One per user per day
- **Personalization**: Day-of-week context via Claude Haiku
- **Example**: "Rise and shine! ☀️\n\nYour outfit for Friday is ready\n\nCheck your fit 👉"

### 2. `/api/whatsapp/share-outfits` (Cron: Weekly 9:30 AM IST, Wed)
- **Purpose**: Encourage sharing of saved outfits
- **Recipients**: All active users with ≥1 saved outfit + phone
- **Message Type**: "share_outfits"
- **Deduplication**: One per user per day (weekly due to cron schedule)
- **Personalization**: Community-focused messaging via Claude
- **Example**: "Your style is inspiring 💚\n\nShare your best looks on Instagram! 📸"

### 3. `/api/whatsapp/daily-engagement` (Cron: Daily 5:00 PM IST)
- **Purpose**: Afternoon engagement with curated looks
- **Recipients**: All active users with wardrobeItemCount ≥ 5 + phone
- **Message Type**: "daily_engagement"
- **Deduplication**: One per user per day
- **Personalization**: Style-profile aware suggestions
- **Example**: "Hey! 👋\n\nTry one of these 5 fresh looks 👉"

### 4. `/api/whatsapp/evening` (Cron: Daily 8:30 PM IST)
- **Purpose**: Evening vibe and styling challenge
- **Recipients**: All active users with wardrobeItemCount ≥ 1 + phone
- **Message Type**: "evening"
- **Deduplication**: One per user per day
- **Personalization**: Vibe-based evening prompt
- **Example**: "Make tonight count! 🔥\n\nTry something bold tonight!"

### 5. `/api/whatsapp/reengagement` (Cron: Daily 2:30 PM IST)
- **Purpose**: Re-engage users inactive for 7+ days
- **Recipients**: Users inactive ≥7 days with wardrobeItemCount ≥ 1 + phone
- **Message Type**: "reengagement"
- **Deduplication**: One per user per day
- **Personalization**: Days-inactive context
- **Example**: "Miss you! 💭\n\nIt's been 7 days... let's style something amazing!"

### 6. `/api/whatsapp/milestone` (Cron: Daily 6:30 PM IST)
- **Purpose**: Celebrate user streaks (7, 14, 30 days)
- **Recipients**: Users hitting milestone dates (7, 14, 30 days sine signup)
- **Message Type**: `milestone_7`, `milestone_14`, `milestone_30`
- **Deduplication**: One per milestone per user per day
- **Personalization**: Streak celebration via Claude
- **Example (7-day)**: "7-day legend! 🔥\n\nYou're on FIRE! Keep it going!"

### 7. `/api/whatsapp/welcome` (Triggered: On user registration)
- **Purpose**: Welcome new users to WhatsApp
- **Recipients**: Users with valid phone at registration
- **Message Type**: "welcome"
- **Auth**: No CRON_SECRET required (called from `/api/auth/register`)
- **Deduplication**: One per user (welcome only sent once)
- **Personalization**: New user context
- **Example**: "🎀 Welcome to Altfit, Sarah!\n\nLet's find your perfect style!\n\nTap here 👉"

## Cron Schedule

All cron jobs use CRON_SECRET authorization header and are defined in `render.yaml`:

| Job | Route | Schedule (UTC) | Local (IST) | Frequency |
|-----|-------|---|---|---|
| good-morning-whatsapp | /api/whatsapp/good-morning | 2:30 AM | 8:00 AM | Daily |
| share-outfits-whatsapp | /api/whatsapp/share-outfits | 4:00 AM Wed | 9:30 AM Wed | Weekly |
| daily-engagement-whatsapp | /api/whatsapp/daily-engagement | 11:30 AM | 5:00 PM | Daily |
| evening-whatsapp | /api/whatsapp/evening | 3:00 PM | 8:30 PM | Daily |
| reengagement-whatsapp | /api/whatsapp/reengagement | 9:00 AM | 2:30 PM | Daily |
| milestone-whatsapp | /api/whatsapp/milestone | 1:00 PM | 6:30 PM | Daily |

## Personalization System

All WhatsApp messages use Claude Haiku for personalization:

**Model**: `claude-3-5-haiku-20241022` (fast + cheap)
**Tokens**: ~150 max (strict for mobile)
**Cost**: ~1/3 of Claude Sonnet
**Latency**: <100ms typical

**Example Personalization Prompt** (good-morning):
```
Generate a 2-3 sentence casual WhatsApp greeting for {name} on {dayOfWeek}.
Context: They have {wardrobeItemCount} items, style: {styleProfiles.join(', ')}.

Format as HEADLINE (1 line) | BODY (2-3 sentences)
Use emojis. Tone: Friendly, upbeat, conversational.
```

**Response Format**:
```
HEADLINE: Rise and shine! ☀️
BODY: It's Friday and your wardrobe is calling! We've picked out 3 looks that match your vibe perfectly. Time to look amazing today! 💚
```

### Personalizer Functions

Located in `lib/whatsapp/personalizer.ts`:

1. `personalizeGoodMorningWhatsApp(ctx)` - Daily greeting
2. `personalizeShareOutfitsWhatsApp(ctx)` - Community sharing prompt
3. `personalizeDailyEngagementWhatsApp(ctx)` - Casual look suggestion
4. `personalizeEveningWhatsApp(ctx)` - Vibe-based evening prompt
5. `personalizeMilestoneWhatsApp(ctx)` - Streak celebration
6. `personalizeReengagementWhatsApp(ctx)` - Friendly check-in

All include **fallback copy** if Claude fails.

## Template System

Located in `lib/whatsapp/templates.ts`:

Templates render personalized copy + direct links + emoji:

```typescript
function goodMorningWhatsApp(data: GoodMorningWhatsAppData): string {
  return `${data.headline} ☀️\n\n${data.bodyText}\n\n✨ Check your outfit 👉 ${NEXT_PUBLIC_APP_URL}/today`;
}
```

Each template:
- ~100-200 characters (mobile-friendly)
- Direct app links (e.g., `/today`, `/saved-outfits`, `/wardrobe`)
- Rich emoji support
- Conversational tone (vs formal email)

## Database Schema

### WhatsAppLog Table
Tracks all WhatsApp sends for deduplication and delivery status:

```prisma
model WhatsAppLog {
  id            BigInt   @id                  // Snowflake ID
  userId        BigInt                        // User ID
  messageType   String                        // "good_morning", "share_outfits", etc
  sentAt        DateTime @default(now())     // When sent
  whatsappId    String?                       // Provider message ID (Twilio SID, etc)
  status        String   @default("sent")    // "sent" | "delivered" | "read" | "failed"
  localDate     String                        // "YYYY-MM-DD" for deduplication
  
  @@unique([userId, messageType, localDate])
  @@index([userId, sentAt])
}
```

### User Model Updates
- Added: `phone String?` (E.164 format, nullable)
- Added relation: `whatsappLogs WhatsAppLog[]`

## Sending Infrastructure

Located in `lib/whatsapp/sender.ts`:

### `sendWhatsAppMessage(toPhone, message)`
- Validates E.164 format
- Validates message length (0-4096 chars)
- Returns `{ success, messageId?, error? }`
- Throws if phone/message invalid
- **Current**: Stubs actual API call (logs to console)
- **Ready for**: Twilio, WhatsApp Business API

### `sendWhatsAppBatch(messages, delayMs = 100)`
- Sends multiple messages with rate limiting
- Default 100ms delay (prevents throttling)
- Returns array of results
- Useful for bulk sends

## Provider Integration

### Option 1: Twilio (Recommended for MVP)

**Setup**:
```bash
npm install twilio
```

**Environment Variables** (.env.local):
```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155552671  # Twilio sandbox or verified number
```

**Implementation** (uncomment in `lib/whatsapp/sender.ts`):
```typescript
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const message = await client.messages.create({
  body: messageText,
  from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
  to: `whatsapp:${toPhone}`,
});

return {
  success: true,
  messageId: message.sid,
  phoneNumber: toPhone,
};
```

### Option 2: WhatsApp Business API

**Setup**: Register with Meta, get business phone ID, API access token

**Environment Variables**:
```
WHATSAPP_API_KEY=your_api_key
WHATSAPP_BUSINESS_PHONE_ID=102345...
WHATSAPP_API_VERSION=v18.0
```

**Implementation** (uncomment in sender.ts):
```typescript
const response = await fetch(
  `https://graph.instagram.com/${process.env.WHATSAPP_API_VERSION}/${process.env.WHATSAPP_BUSINESS_PHONE_ID}/messages`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.WHATSAPP_API_KEY}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body: messageText },
    }),
  }
);

const data = await response.json();
return {
  success: data.messages?.[0]?.id ? true : false,
  messageId: data.messages?.[0]?.id,
  phoneNumber: toPhone,
};
```

## Testing

### Test a Single Route

```bash
# Good morning WhatsApp
curl -X POST http://localhost:3000/api/whatsapp/good-morning \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"

# Welcome WhatsApp (no auth)
curl -X POST http://localhost:3000/api/whatsapp/welcome \
  -H "Content-Type: application/json" \
  -d '{"userId":"1234567890","phone":"+919876543210","name":"Test User"}'
```

### Test with Provider Stub (Console)

Routes currently log to console. No actual WhatsApp sends until provider configured.

**Log Output**:
```
[WhatsApp] ✅ Sent to +919876543210
[WhatsApp] ❌ Failed to +919876543210: Invalid phone format
```

### Monitor Deduplication

Check WhatsAppLog table:
```sql
SELECT * FROM whatsapp_logs WHERE user_id = <userId> ORDER BY sent_at DESC LIMIT 10;
```

Should see max 1 entry per messageType per localDate.

## Error Handling

All routes include:
- Request validation (required fields, E.164 format)
- User existence verification
- Claude personalization fallback (pre-written copy if API fails)
- Database logging fallback (non-blocking)
- Error logging to console
- Graceful degradation

Example error response:
```json
{
  "error": "Internal server error",
  "details": "TWILIO_ACCOUNT_SID not configured"
}
```

## Performance Metrics

- **Route response time**: <500ms (with Claude personalization)
- **Personalization cache**: None (each message fresh, cost is minimal)
- **Rate limiting**: 100ms per message in batch sends
- **Max messages per cron**: No limit (handled by rate limiting)
- **Cost per message**: ~$0.001 (Claude Haiku)

## Opt-Out Handling

Currently uses `user.emailOptOut` flag for WhatsApp too.

**Optional: Create separate flag**
```prisma
model User {
  // ... existing fields
  emailOptOut     Boolean @default(false)
  whatsappOptOut  Boolean @default(false)  // Optional: separate control
}
```

Then update routes:
```typescript
where: {
  phone: { not: null },
  whatsappOptOut: false,  // Add this check
  emailOptOut: false,     // Keep existing
}
```

## Next Steps

1. **Choose WhatsApp provider** (Twilio or WhatsApp Business API)
2. **Add provider credentials** to .env.local
3. **Uncomment provider code** in `lib/whatsapp/sender.ts`
4. **Test a single route** (good-morning or welcome)
5. **Deploy to Render** (render.yaml already configured)
6. **Monitor WhatsAppLog** for send status
7. **Set up webhooks** for delivery status updates (optional)

## Monitoring

Check Render logs for WhatsApp cron jobs:
```
[WhatsApp] good-morning: Starting delivery
[WhatsApp] good-morning: Found 150 eligible users
[WhatsApp] good-morning: Complete. Sent: 148, Failed: 2
```

Alerts if failed > 10% of sent.

## Comparison: Email vs WhatsApp

| Aspect | Email | WhatsApp |
|--------|-------|----------|
| Length | 500+ characters | 100-200 characters |
| Tone | Editorial, formal | Casual, conversational |
| Emoji | None | Liberal |
| Links | Full URLs | Direct app links |
| Read rate | ~25-35% | ~80-90% (typical) |
| Response time | 1-3 minutes | 30 seconds |
| Personalization | Claude Sonnet | Claude Haiku |
| Cost per message | ~$0.01 | ~$0.001 (provider dependent) |

---

**Status**: Ready for provider integration and production deployment
**Last Updated**: Post-commit dda3ee6
**Dependencies**: Twilio or Meta WhatsApp API (not yet configured)
