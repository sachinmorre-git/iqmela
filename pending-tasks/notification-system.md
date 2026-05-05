# IQMela — Pending Notification Tasks (External Integration Required)

> Last Updated: 2026-05-02

## ⚡ Notification Philosophy — "Signal, Not Noise"
Our notification system follows a strict **high-signal-only** principle:

| Event | Bell? | Push? | Who? | Why |
|-------|-------|-------|------|-----|
| **Offer approval request** | ✅ | ✅ | Specific approver only | Actionable + time-sensitive |
| **Candidate HIRED** | ✅ | ❌ | ORG_ADMINs only | Rare terminal event, audit trail |
| **Candidate REJECTED** | ✅ | ❌ | ORG_ADMINs only | Audit trail |
| **AI Interview scored** | ✅ | ❌ | Position owner only | 1 person, not the whole team |
| Candidate advanced | ❌ | ❌ | — | Routine, visible in pipeline |
| Offer extended | ❌ | ❌ | — | Approvers already get their own notif |
| Resume uploaded | ❌ | ❌ | — | Visible in position tracker |

**Rules:**
1. Never notify for **routine pipeline actions** (advance, hold) — that's what the dashboard is for
2. **Push notifications are reserved** for actionable items only (approvals requiring a click)
3. Bell notifications are limited to **terminal events** (hire/reject) or **action-needed** (approval requests)
4. Each notification goes to the **minimum viable audience** — not broadcast

---

## Context
The notification infrastructure has been implemented across all 6 phases. This file tracks items that require either:
- External service configuration (VAPID keys, Resend templates)
- Manual testing with live data
- Future feature expansion

---

## 1. 🔑 VAPID Keys — Browser Push Activation
**Status:** Infrastructure ready, keys NOT generated yet

### Steps to Activate:
```bash
npx web-push generate-vapid-keys
```

### Add to `.env.local` and Vercel Dashboard:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generated-public-key>
VAPID_PRIVATE_KEY=<generated-private-key>
VAPID_SUBJECT=mailto:admin@iqmela.com
```

> [!IMPORTANT]  
> Until these are set, browser push notifications silently skip (no errors). The in-app bell and toasts work independently.

---

## 2. 📧 Missing Email Notifications (Phase 4 — Deferred)
These email triggers should be added to the respective server actions when the features are production-ready:

| # | Trigger | File to Modify | Priority |
|---|---------|----------------|----------|
| 1 | Offer accepted by candidate | `src/app/offer/[token]/actions.ts` | 🔴 Critical |
| 2 | Offer declined by candidate | `src/app/offer/[token]/actions.ts` | 🔴 Critical |
| 3 | Candidate asked a question on offer | `src/app/offer/[token]/actions.ts` | 🔴 Critical |
| 4 | BGV check completed | `src/app/api/bgv/upload/[token]/route.ts` | 🟡 High |
| 5 | BGV dispute raised | `src/app/org-admin/positions/[id]/bgv-actions.ts` | 🟡 High |
| 6 | All panelist feedback submitted | `src/app/org-admin/positions/[id]/pipeline-actions.ts` | 🟡 High |
| 7 | Candidate rejection letter | New template needed | 🟡 High |
| 8 | New resume uploaded (vendor → client) | `src/app/org-admin/vendor-portal/actions.ts` | 🟢 Medium |
| 9 | Position closed | `src/app/org-admin/positions/[id]/actions.ts` | 🟢 Medium |
| 10 | Billing token threshold (85%) | Cron job needed | 🟢 Medium |
| 11 | Weekly hiring summary digest | Cron job needed | 🟢 Medium |
| 12 | Proctor alert flagged | `src/app/api/livekit/webhook/route.ts` | 🟢 Medium |

---

## 3. 🎨 Push Notification Icons (Phase 6)
Currently using existing PWA icons. For a premium experience, generate:

| Asset | Spec | Purpose |
|-------|------|---------|
| `iq-push-96.png` | 96×96, transparent | Chrome/Firefox push popup icon |
| `iq-badge-72.png` | 72×72, monochrome white | Android notification tray badge |

Source SVG available at: `/public/brand/icon/iq-icon.svg`

---

## 4. 📧 Branded Email Header
The generic email template (`sendGenericEmail`) currently uses plain text "IQMela · Intelligent Hiring Platform" in the footer. For brand consistency:

- Create a branded HTML email header using the IQMela logo
- Add it to `src/lib/email/templates/components/Header.tsx`
- Integrate into all React Email templates

---

## 5. 🔄 Real-Time Notification Streaming (Future)
Currently the NotificationBell polls every 30 seconds. For true real-time:

**Option A:** Server-Sent Events (SSE)
- Add `/api/notifications/stream` endpoint
- Use EventSource in NotificationBell

**Option B:** WebSocket via Socket.io
- Heavier but supports bidirectional

**Recommendation:** SSE is simpler and sufficient for notification feeds.

---

## 6. 📊 Notification Preferences Page (Future)
Allow users to customize which notifications they receive via:
- In-app bell (always on)
- Email (configurable per type)
- Browser push (configurable per type)

Would require a `NotificationPreference` Prisma model and a settings UI at `/org-admin/settings/notifications`.

---

## 7. 🔍 SEO — robots.txt BLOCKER
> [!CAUTION]  
> `public/robots.txt` still blocks ALL search engines (`Disallow: /`).
> **MUST be removed before public launch.**
