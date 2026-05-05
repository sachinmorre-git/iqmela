# IQMela — Pending External Integration Tasks

> **Purpose**: This file tracks ALL external configurations, third-party dashboard setups, and manual steps required before the platform is fully production-ready. Check off items as you complete them.
>
> **Last Updated**: 2026-05-02

---

## 🔴 Critical — Must Complete Before Launch

### 1. Remove `robots.txt` Crawler Block
- [ ] **Action**: Delete or update `public/robots.txt` to allow search engine indexing
- **Current state**: Blocks ALL crawlers — Google Jobs, Indeed, Bing will NOT index the site
- **File**: `public/robots.txt`
- **Impact**: No SEO, no Google Jobs listings, no organic traffic

### 2. Resend Email Webhook Configuration
- [ ] **Action**: Register webhook endpoint in [Resend Dashboard](https://resend.com/webhooks)
- **URL to register**: `https://www.iqmela.com/api/webhooks/resend`
- **Events to subscribe**: `email.delivered`, `email.bounced`, `email.complained`, `email.opened`, `email.clicked`
- **Env var to set**: `EMAIL_WEBHOOK_SECRET` — Resend provides this (Svix signing secret) when you create the webhook endpoint
- **Impact**: Without this, bounced interview invites won't auto-revert to DRAFT, no delivery tracking

### 3. CRON_SECRET Environment Variable
- [ ] **Action**: Set `CRON_SECRET` in Vercel Dashboard → Environment Variables
- **Value**: Generate a strong random string (`openssl rand -hex 32`)
- **Where**: Vercel Dashboard → Project → Settings → Environment Variables
- **Impact**: All 4 cron jobs (`poll-nudge`, `intake-purge`, `process-closed-positions`, `purge-resumes`) will fail auth without this

---

## 🟡 Required for Full Feature Set

### 4. LinkedIn OAuth App & Webhook
- [ ] **Action**: Create/configure LinkedIn OAuth App at [LinkedIn Developer Portal](https://developer.linkedin.com/)
- [ ] **Action**: Register webhook URL: `https://www.iqmela.com/api/webhooks/linkedin-apply`
- **Env vars to set**:
  - `LINKEDIN_CLIENT_ID` — from LinkedIn App Dashboard
  - `LINKEDIN_CLIENT_SECRET` — from LinkedIn App Dashboard
  - `LINKEDIN_WEBHOOK_SECRET` — provided by LinkedIn when you register the webhook (HMAC-SHA256)
- **Feature unlocked**: LinkedIn Easy Apply integration → auto-intake candidates from LinkedIn

### 5. Indeed Employer Portal Configuration
- [ ] **Action**: Register XML feed URL in [Indeed Employer Portal](https://employers.indeed.com/)
- **Feed URL**: `https://www.iqmela.com/api/public/jobs-feed`
- [ ] **Action**: Configure webhook endpoint in Indeed API Settings
- **Webhook URL**: `https://www.iqmela.com/api/webhooks/intake`
- **Env var to set**:
  - `INTAKE_WEBHOOK_KEY` — self-generated API key, set in both Indeed and Vercel
- **Feature unlocked**: Jobs listed on Indeed + auto-intake from Indeed applications

### 6. DocuSign Connect Webhook
- [ ] **Action**: Configure Connect in [DocuSign Admin](https://admin.docusign.com/) → Connect → Add Configuration
- **Webhook URL**: `https://www.iqmela.com/api/webhooks/docusign`
- **Events**: `envelope-completed`
- **Env vars to set**:
  - `DOCUSIGN_HMAC_KEY` — configured in DocuSign Connect settings (HMAC-SHA256)
  - `DOCUSIGN_INTEGRATION_KEY` — from DocuSign Developer Dashboard
  - `DOCUSIGN_API_ACCOUNT_ID` — from DocuSign API Account settings
  - `DOCUSIGN_RSA_PRIVATE_KEY` — JWT auth private key (base64 encoded)
- **Feature unlocked**: Auto-mark offers as ACCEPTED when candidates sign via DocuSign

### 7. LiveKit Server Configuration
- [ ] **Action**: Ensure LiveKit Cloud or self-hosted server is accessible
- **Env vars to set**:
  - `LIVEKIT_URL` — WebSocket URL (e.g., `wss://your-project.livekit.cloud`)
  - `LIVEKIT_API_KEY` — from LiveKit Dashboard
  - `LIVEKIT_API_SECRET` — from LiveKit Dashboard
- **Feature unlocked**: Live human video interviews with recording

---

## 🟢 Optional — Post-Launch Enhancements

### 8. Google Jobs Integration
- [ ] **Action**: Submit sitemap at [Google Search Console](https://search.google.com/search-console)
- **Sitemap URL**: `https://www.iqmela.com/sitemap.xml` (needs to be created if not present)
- **Note**: Google Jobs auto-discovers structured data from pages. The careers page should include `JobPosting` JSON-LD schema.
- **Prerequisite**: `robots.txt` must be fixed first (#1)

### 9. Cloudflare R2 Storage
- [ ] **Action**: Verify R2 bucket configuration for resume and recording storage
- **Env vars**:
  - `R2_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
  - `R2_BUCKET_NAME`
  - `R2_PUBLIC_URL`

### 10. AI Provider API Keys
- [ ] **Action**: Ensure AI API keys are set for production workloads
- **Env vars**:
  - `GOOGLE_GENERATIVE_AI_API_KEY` — Gemini (primary AI provider)
  - `DEEPSEEK_API_KEY` — DeepSeek (fallback/secondary)
  - `ELEVENLABS_API_KEY` — ElevenLabs TTS (optional, browser TTS is free fallback)

### 11. Clerk Authentication
- [ ] **Action**: Verify production Clerk instance is configured
- **Env vars**:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET` — if using Clerk webhooks for user sync

### 12. Domain & DNS
- [ ] **Action**: Verify DNS records for `iqmela.com` on GoDaddy/Cloudflare
  - A-record → Vercel
  - MX records → Zoho Mail
  - TXT records → SPF, DKIM, DMARC for email deliverability
  - CNAME → `www` redirect

---

## 📋 Complete Environment Variables Checklist

| Variable | Provider | Category | Status |
|---|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk | Auth | ⬜ Verify |
| `CLERK_SECRET_KEY` | Clerk | Auth | ⬜ Verify |
| `DATABASE_URL` | Neon/Supabase | Database | ⬜ Verify |
| `RESEND_API_KEY` | Resend | Email | ⬜ Verify |
| `EMAIL_WEBHOOK_SECRET` | Resend | Email Webhook | ⬜ Set |
| `CRON_SECRET` | Self-generated | Cron Auth | ⬜ Set |
| `LINKEDIN_CLIENT_ID` | LinkedIn | Distribution | ⬜ Set |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn | Distribution | ⬜ Set |
| `LINKEDIN_WEBHOOK_SECRET` | LinkedIn | Webhook | ⬜ Set |
| `INTAKE_WEBHOOK_KEY` | Self-generated | Indeed Webhook | ⬜ Set |
| `DOCUSIGN_HMAC_KEY` | DocuSign | Offer Signing | ⬜ Set |
| `DOCUSIGN_INTEGRATION_KEY` | DocuSign | Offer Signing | ⬜ Set |
| `DOCUSIGN_API_ACCOUNT_ID` | DocuSign | Offer Signing | ⬜ Set |
| `DOCUSIGN_RSA_PRIVATE_KEY` | DocuSign | Offer Signing | ⬜ Set |
| `LIVEKIT_URL` | LiveKit | Video Interviews | ⬜ Verify |
| `LIVEKIT_API_KEY` | LiveKit | Video Interviews | ⬜ Verify |
| `LIVEKIT_API_SECRET` | LiveKit | Video Interviews | ⬜ Verify |
| `R2_ACCOUNT_ID` | Cloudflare | Storage | ⬜ Verify |
| `R2_ACCESS_KEY_ID` | Cloudflare | Storage | ⬜ Verify |
| `R2_SECRET_ACCESS_KEY` | Cloudflare | Storage | ⬜ Verify |
| `R2_BUCKET_NAME` | Cloudflare | Storage | ⬜ Verify |
| `R2_PUBLIC_URL` | Cloudflare | Storage | ⬜ Verify |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google | AI | ⬜ Verify |
| `DEEPSEEK_API_KEY` | DeepSeek | AI Fallback | ⬜ Verify |
| `ELEVENLABS_API_KEY` | ElevenLabs | TTS (Optional) | ⬜ Set |
| `NEXT_PUBLIC_APP_URL` | Self | App Config | ⬜ Verify |
| `TTS_PROVIDER` | Self | AI Interview | ⬜ Set (`browser` or `elevenlabs`) |
| `VISUAL_MODE` | Self | AI Interview | ⬜ Set (`orb` or `tavus`) |

---

## 🔄 Vercel Cron Jobs Summary

| Cron | Schedule | Purpose |
|---|---|---|
| `/api/cron/poll-nudge` | Daily 8 AM UTC | Sends feedback nudge reminders to interviewers |
| `/api/cron/intake-purge` | Weekly Sunday 3 AM | Purges expired intake candidates per GDPR retention |
| `/api/cron/process-closed-positions` | Daily 6 AM UTC | Closes external job board listings for expired positions |
| `/api/cron/purge-resumes` | Weekly Monday 2 AM | Deletes stored resume files past retention period |

All crons require `CRON_SECRET` env var to be set.

---

## Notes for Future Reference

- **Webhook testing**: Use Resend, LinkedIn, and DocuSign sandbox/test modes before switching to production credentials
- **Cron monitoring**: Check Vercel Dashboard → Functions → Cron for execution logs
- **Rollback**: If any webhook starts failing, the endpoints are designed to return 200 even on DB errors to prevent infinite retries from the provider
- **Rate limits**: Public apply endpoint is limited to 5 applications per IP per hour (in-memory, resets on deploy)
