# Dev Data Reset Guide

For local development, you can quickly reset all wardrobe-related data using the reset script.

## Quick Start

```bash
# Interactive mode (will ask for confirmation)
npm run reset:dev

# Force mode (skips confirmation, useful for CI/automation)
npm run reset:dev:force
```

## What Gets Deleted

✓ **Supabase Storage**

- All images in the `wardrobe-images` bucket

✓ **Database Records**

- `DailyCuration` — all curated outfit suggestions
- `OutfitItem` — all outfit compositions
- `Outfit` — all saved outfit cards
- `WardrobeItem` — all clothing pieces
- `User.wardrobeItemCount` — reset to 0

## Before Running

Ensure your dev environment is set up:

```bash
npm install                    # Install dependencies (includes tsx)
npx prisma db push           # Ensure database schema is pushed
```

## Safety Features

- ✓ Won't run if `NODE_ENV=production` or `ENVIRONMENT=production`
- ✓ Asks for confirmation unless `--force` is used
- ✓ Respects foreign key cascade relationships

## Troubleshooting

**Script hangs after asking for confirmation?**

- Make sure you type "yes" or "y" and press Enter
- Or use `npm run reset:dev:force` to skip confirmation

**"Supabase not configured" warning?**

- Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to your `.env.local`
- The script will still delete database records even if Supabase is unavailable

**Database connection error?**

- Check that your `DATABASE_URL` in `.env.local` points to a running Postgres instance
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

## Under the Hood

The script is located at `scripts/reset-dev-data.ts` and:

- Uses Prisma to delete all records in the correct cascade order
- Uses Supabase admin client to delete images from storage
- Logs progress with emoji indicators (✓ for success, ❌ for errors)
- Disconnects from Prisma cleanly before exiting

See `scripts/README.md` for more detailed documentation.
