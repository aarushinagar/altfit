# ALTFIT Deployment Checklist

Complete this checklist before deploying to production.

---

## Phase 1: Pre-Deployment Setup ✅

- [ ] **Environment Configuration**
  - [ ] Create `.env.local` based on `.env.example`
  - [ ] Fill in all required secrets (JWT_SECRET, API keys, database URL)
  - [ ] Verify `NODE_ENV=production` in production ENV
  - [ ] Use PRODUCTION keys/credentials (not sandbox/test keys)

- [ ] **Database Setup**
  - [ ] Supabase project created and configured
  - [ ] Database migrations run: `npm run db:push`
  - [ ] All tables created in Supabase
  - [ ] RLS policies configured for all tables
  - [ ] Storage buckets created: `wardrobe-images`, `profile-avatars`

- [ ] **Third-Party Services**
  - [ ] Google OAuth credentials created (client ID & secret)
  - [ ] Google OAuth authorized domains configured
  - [ ] Anthropic API key generated
  - [ ] Razorpay account created (live mode, not sandbox)
  - [ ] Razorpay keys obtained (Key ID & Secret)
  - [ ] Supabase service role key obtained

- [ ] **Code Review**
  - [ ] All API routes implement proper error handling
  - [ ] All auth endpoints require valid JWT tokens
  - [ ] All user data endpoints check user isolation
  - [ ] No hardcoded API keys or credentials in code
  - [ ] No `console.log` statements with sensitive data

---

## Phase 2: Code Quality & Testing ✅

- [ ] **Build & Compilation**
  - [ ] `npm run build` completes without errors
  - [ ] TypeScript compilation passes: `npx tsc --noEmit`
  - [ ] ESLint passes: `npx eslint .`
  - [ ] No TypeScript errors in VS Code
  - [ ] No console errors in browser dev tools

- [ ] **Auth Flow Testing**
  - [ ] User registration works (email + password)
  - [ ] User login works
  - [ ] JWT token is generated and valid
  - [ ] Token refresh works
  - [ ] User logout works
  - [ ] Google OAuth login works
  - [ ] Auth token expires after 15 minutes
  - [ ] Refresh token refreshes JWT correctly
  - [ ] Cannot access protected routes without token

- [ ] **Wardrobe Feature Testing**
  - [ ] Create wardrobe item works
  - [ ] Read wardrobe items works (with pagination)
  - [ ] Update wardrobe item works
  - [ ] Delete wardrobe item works
  - [ ] Wardrobe items show only for current user
  - [ ] Item wear count increments correctly
  - [ ] Bulk upload works for multiple items

- [ ] **Outfit Generation Testing**
  - [ ] Generate outfit from wardrobe works
  - [ ] AI classification works (image upload → category)
  - [ ] Outfit history is saved
  - [ ] Mark outfit as worn increments counter
  - [ ] Outfit data shows only for current user

- [ ] **File Upload Testing**
  - [ ] Image upload works (JPEG, PNG, WebP, GIF)
  - [ ] File size limit enforced (5MB max)
  - [ ] Images stored in Supabase with public CDN URL
  - [ ] Images can be deleted
  - [ ] Non-image files are rejected

- [ ] **Payment Flow Testing (if required)**
  - [ ] Create subscription order works
  - [ ] Razorpay payment modal opens
  - [ ] Payment verification works (test card)
  - [ ] Subscription status updates after payment
  - [ ] User cannot access paid features without active subscription

- [ ] **API Response Testing**
  - [ ] Success responses return `200/201/204`
  - [ ] Error responses return proper status codes (`400`, `401`, `403`, `404`, `500`)
  - [ ] Error messages are descriptive and helpful
  - [ ] All responses include proper headers (CORS, Content-Type, etc.)
  - [ ] No sensitive data leaked in error messages

- [ ] **Edge Cases & Error Handling**
  - [ ] Invalid JWT tokens are rejected
  - [ ] Expired tokens trigger 401 response
  - [ ] Missing required fields return validation errors
  - [ ] Accessing other users' data returns 403 Forbidden
  - [ ] Database errors return 500 without leaking details
  - [ ] Network timeouts are handled gracefully
  - [ ] External API failures (Anthropic, etc.) don't crash app

---

## Phase 3: Security Checks ✅

- [ ] **Authentication Security**
  - [ ] Passwords hashed with bcrypt (never stored plain text)
  - [ ] JWT secret is strong (min 32 characters)
  - [ ] JWT_SECRET is different in dev vs production
  - [ ] Refresh tokens stored in httpOnly cookies
  - [ ] Session invalidation works on logout
  - [ ] No JWT tokens in URL parameters (always in headers/cookies)

- [ ] **Data Protection**
  - [ ] User data isolated by user_id (RLS policies enforced)
  - [ ] Database credentials NOT in frontend code
  - [ ] API keys NOT exposed to browser
  - [ ] Supabase service role key only on server
  - [ ] No sensitive data in localStorage (except JWT for reading)

- [ ] **API Security**
  - [ ] All sensitive endpoints require authentication
  - [ ] Rate limiting implemented on auth endpoints
  - [ ] Rate limiting implemented on payment endpoints
  - [ ] HTTPS required in production (redirect http → https)
  - [ ] CORS headers properly configured
  - [ ] No sensitive headers exposed
  - [ ] SQL injection impossible (using Prisma ORM)
  - [ ] XSS protection in place (sanitized inputs)

- [ ] **Account Security**
  - [ ] Account deletion removes ALL user data (cascade)
  - [ ] Password change doesn't break existing sessions
  - [ ] Account recovery flow exists (or documented as N/A)
  - [ ] No option to change email to existing user email

---

## Phase 4: Performance & Monitoring ✅

- [ ] **Performance**
  - [ ] Homepage loads in < 2 seconds
  - [ ] API endpoints respond in < 500ms
  - [ ] Database queries use proper indexing
  - [ ] Image uploads optimized (compression, CDN)
  - [ ] No memory leaks in long-running dev session

- [ ] **Monitoring & Logging**
  - [ ] Error logging configured for production
  - [ ] Request logging captures important events
  - [ ] Payment transactions logged with timestamps
  - [ ] Failed auth attempts logged (for security monitoring)
  - [ ] API response times monitored

- [ ] **Infrastructure**
  - [ ] Next.js build optimized (no unused code)
  - [ ] Environment variables loaded correctly at startup
  - [ ] Health check endpoint works `/api/health` (optional)
  - [ ] Server doesn't expose stack traces to users

---

## Phase 5: Deployment Configuration ✅

### Vercel Deployment (Recommended)

- [ ] **Project Setup**
  - [ ] GitHub repository connected to Vercel
  - [ ] All environment variables added in Vercel dashboard
  - [ ] `DIRECT_URL` configured for migrations
  - [ ] Build settings correct (Next.js auto-detected)

- [ ] **Deployment**
  - [ ] Preview deployment passes all checks
  - [ ] Production deployment completes successfully
  - [ ] Staging environment available for testing
  - [ ] Automatic deploys on git push configured (optional)

- [ ] **Post-Deployment**
  - [ ] Test login at production URL
  - [ ] Test wardrobe CRUD at production URL
  - [ ] Test image upload at production URL
  - [ ] Check logs for errors: `vercel logs`
  - [ ] Verify all env vars loaded correctly

### Alternative Hosting (AWS, Docker, etc.)

- [ ] **Build Command**: `npm run build` works
- [ ] **Start Command**: `npm run start` works on target server
- [ ] **Node Version**: Running on compatible Node version
- [ ] **Port Configuration**: Server listens on `$PORT` environment variable
- [ ] **Database Access**: Migration can run during deployment
- [ ] **Static Assets**: Supabase CDN used for wardrobe images

---

## Phase 6: Post-Deployment Validation ✅

- [ ] **Live Site Testing**
  - [ ] Home page loads (check actual production domain)
  - [ ] User registration works on live site
  - [ ] Email verification works (if applicable)
  - [ ] Google login works on live site
  - [ ] All API requests use HTTPS (not HTTP)
  - [ ] No console errors in production browser

- [ ] **Database Verification**
  - [ ] New user data appears in production database
  - [ ] Wardrobe items saved correctly
  - [ ] Images visible at Supabase CDN URLs
  - [ ] Payments recorded in subscriptions table

- [ ] **External Services**
  - [ ] Anthropic API calls work (outfit generation works)
  - [ ] Email notifications sent (if configured)
  - [ ] Razorpay integration works with live keys

- [ ] **Monitoring**
  - [ ] Error tracking tool configured (Sentry, etc.)
  - [ ] Analytics setup (optional but recommended)
  - [ ] Uptime monitoring configured
  - [ ] Alert notifications set up for critical errors

---

## Phase 7: Documentation & Handoff ✅

- [ ] **Documentation Complete**
  - [ ] README.md has clear setup instructions
  - [ ] `.env.example` documented with all variables
  - [ ] SUPABASE_SETUP.md complete
  - [ ] API endpoint documentation available
  - [ ] Known issues logged in ISSUES.md (if any)

- [ ] **Runbook for Operations**
  - [ ] How to scale database connections
  - [ ] How to rotate API keys
  - [ ] How to handle payment refunds
  - [ ] Emergency rollback procedure documented

- [ ] **Team Knowledge Transfer**
  - [ ] Team trained on deployment process
  - [ ] On-call runbook shared with team
  - [ ] Access credentials secured (1Password, etc.)
  - [ ] Monitoring dashboards accessible to team

---

## Final Go/No-Go Decision

### Go to Production ✅
All boxes checked above AND:
- [ ] Team approval obtained
- [ ] No blocking issues remain
- [ ] Fallback plan in place (rollback, support contacts)
- [ ] Go-live announcement ready

### No-Go / Delay ❌
If any of these are true:
- [ ] Critical security issues unfixed
- [ ] Auth flow broken
- [ ] Database corruption or migration failures
- [ ] External APIs (Anthropic, Razorpay) not responding
- [ ] Performance unacceptable (> 5s load time)

---

## Deployment Record

**Deployment Date**: _______________

**Deployed By**: _______________

**Environment**: ☐ Staging  ☐ Production

**Version/Commit**: _______________

**Issues Found**: _______________

**Rollback Plan**: _______________

---

## Post-Launch Monitoring (First 24 hours)

- [ ] Monitor error logs every hour
- [ ] Check payment processing is working
- [ ] Verify user registrations going through
- [ ] Monitor database performance
- [ ] Check external API usage/quotas
- [ ] Be available for quick hotfixes if needed

