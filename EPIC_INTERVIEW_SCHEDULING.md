# EPIC: Interview Scheduling & RBAC Enforcement

> **Created:** 2026-04-17  
> **Owner:** Sachin More  
> **Status:** 🔶 Draft — Awaiting Review  
> **Depends On:** [RBAC_MATRIX.md](./RBAC_MATRIX.md)

---

## Overview

Build a production-ready interview scheduling system inside the Org Admin portal and enforce the Phase 1 RBAC matrix across **every** existing page. When this EPIC is complete, every route is guarded, every action is permission-checked, and the interview scheduling workflow is fully operational.

### What Exists Today

| Component | Status | Location |
|---|---|---|
| `Interview` model | ✅ Exists | `prisma/schema.prisma` — `candidateId`, `interviewerId`, `interviewMode` |
| `AiInterviewSession` model | ✅ Exists | Full AI avatar pipeline with turns, scoring, magic links |
| `AiInterviewConfig` model | ✅ Exists | Per-position or per-interview AI config |
| Interviewer schedule page | ✅ Exists | `/interviewer/schedule` — basic form, NO org scoping |
| AI interview invite from position | ✅ Exists | `BulkInviteForm.tsx` + `AiInterviewInviteButton.tsx` |
| Reviews page | ✅ Exists | `/org-admin/reviews` — AI interviews needing human review |
| Invites page | ✅ Exists | `/org-admin/invites` — team invite tracker |
| RBAC engine | ✅ Exists | `src/lib/rbac.ts` — `getCallerPermissions()` |
| Org Admin interview scheduling | ❌ Missing | No interview scheduling from the org-admin pipeline |
| RBAC enforcement on pages | ❌ Missing | Most pages have zero permission checks |
| Position detail action guards | ❌ Missing | 37K `actions.ts` has no role verification |

---

## Story 0: Cleanup & Prerequisites

**Goal:** Remove dead links, fix stale references, and prep the codebase.

#### Tasks

- [ ] **0.1** Audit sidebar nav links — remove or stub `Candidates` and `Resume Ranking` if no pages exist for them
- [ ] **0.2** Add "Reviews" link to sidebar nav (currently missing — page exists but no nav entry)
- [ ] **0.3** Clean up `InviteRow` type — remove stale `deptOpen: boolean` field from `InviteMemberForm.tsx`
- [ ] **0.4** Delete the `RBAC_MATRIX.yml` file (superseded by `.md`)

#### Validation
- Sidebar has no dead links
- All existing pages are reachable from nav

---

## Story 1: RBAC Enforcement — Every Page Guarded

**Goal:** Apply the Phase 1 RBAC matrix to every org-admin route. No page should be accessible without the correct role.

### 1A. Permission Engine Update

- [ ] **1.1** Update `src/lib/rbac.ts` → add granular permission flags:

```
canViewPositions        → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canManagePositions      → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canUploadResumes        → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canRunAI                → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canScheduleInterview    → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canScheduleAiInterview  → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canConductInterview     → ALL org roles (including INTERVIEWER)
canSubmitFeedback       → ALL org roles (including INTERVIEWER)
canMakeHireDecision     → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canViewReviews          → ORG_ADMIN, DEPT_ADMIN, RECRUITER, HIRING_MANAGER
canManageInvites        → ORG_ADMIN, DEPT_ADMIN
canManageBilling        → ORG_ADMIN only
canManageSettings       → ORG_ADMIN only
canViewActivity         → ORG_ADMIN only
canManageDepartments    → ORG_ADMIN only
```

### 1B. Admin-Only Page Guards (ORG_ADMIN exclusive)

| Page | File | Guard |
|---|---|---|
| Billing | `/org-admin/billing/page.tsx` | Redirect if `!perms.canManageBilling` |
| Settings | `/org-admin/settings/page.tsx` | Redirect if `!perms.canManageSettings` |
| Activity Log | `/org-admin/activity/page.tsx` | Redirect if `!perms.canViewActivity` |
| Departments | `/org-admin/departments/page.tsx` | Redirect if `!perms.canManageDepartments` |

- [ ] **1.2** Add `getCallerPermissions()` guard to `/org-admin/billing/page.tsx`
- [ ] **1.3** Add `getCallerPermissions()` guard to `/org-admin/settings/page.tsx`
- [ ] **1.4** Add `getCallerPermissions()` guard to `/org-admin/activity/page.tsx`
- [ ] **1.5** Add `getCallerPermissions()` guard to `/org-admin/departments/page.tsx`

### 1C. Pipeline Page Guards (scoped by department)

| Page | File | Guard |
|---|---|---|
| Positions list | `/org-admin/positions/page.tsx` | Filter by `scopedDeptIds` |
| Position detail | `/org-admin/positions/[id]/page.tsx` | Verify position's dept ∈ `scopedDeptIds` |
| Position create | `/org-admin/positions/new/page.tsx` | Verify `canManagePositions` |
| Position edit | `/org-admin/positions/[id]/edit/page.tsx` | Verify `canManagePositions` + dept scope |
| Resume detail | `/org-admin/resumes/[id]/page.tsx` | Verify resume's position dept ∈ `scopedDeptIds` |
| Reviews | `/org-admin/reviews/page.tsx` | Filter by `scopedDeptIds`, verify `canViewReviews` |
| Invites | `/org-admin/invites/page.tsx` | Verify `canManageInvites` |

- [ ] **1.6** Guard `/org-admin/positions/page.tsx` — scope by department
- [ ] **1.7** Guard `/org-admin/positions/[id]/page.tsx` — verify dept access
- [ ] **1.8** Guard `/org-admin/positions/new/page.tsx` — verify `canManagePositions`
- [ ] **1.9** Guard `/org-admin/positions/[id]/edit/page.tsx` — verify dept + permission
- [ ] **1.10** Guard `/org-admin/resumes/[id]/page.tsx` — verify dept scope
- [ ] **1.11** Guard `/org-admin/reviews/page.tsx` — scope by dept, verify `canViewReviews`
- [ ] **1.12** Guard `/org-admin/invites/page.tsx` — verify `canManageInvites`

### 1D. Server Action Guards

- [ ] **1.13** Guard position `actions.ts` (37K file) — add `getCallerPermissions()` check at the top of:
  - `uploadResume`, `bulkExtract`, `bulkRank`, `analyzeJd`, `bulkAdvancedJudgment`
  - `shortlistCandidate`, `overrideCandidate`
  - Verify `canUploadResumes`, `canRunAI`, `canMakeHireDecision` respectively
- [ ] **1.14** Guard `ai-interview-actions.ts` — verify `canScheduleAiInterview`
- [ ] **1.15** Guard team `actions.ts` — already partially done, verify completeness

### 1E. Sidebar Nav Driven by Permissions

- [ ] **1.16** Update `/org-admin/layout.tsx` sidebar:
  - Replace hardcoded `canSee*` booleans with actual `perms.*` flags
  - Add "Interviews" nav link (Story 3)
  - Add "Reviews" nav link
  - Remove dead `Candidates` / `Resume Ranking` links if pages don't exist
  - Ensure `INTERVIEWER`-only users see only: Dashboard, My Interviews

### 1F. Interviewer Route Protection

- [ ] **1.17** Ensure `INTERVIEWER`-only users hitting `/org-admin/positions` get redirected
- [ ] **1.18** Refactor `/interviewer/schedule/page.tsx` — scope candidates to the user's org, not global

#### Validation
- Log in as `RECRUITER` → can access positions, upload, extract, rank, schedule → cannot access billing, settings, departments
- Log in as `INTERVIEWER` → sees only Dashboard + My Interviews → redirect from positions/team
- Log in as `DEPT_ADMIN` → sees only own department's positions and resumes
- Log in as `ORG_ADMIN` → sees everything
- Directly navigate to `/org-admin/billing` as `RECRUITER` → get redirected

---

## Story 2: Interview Scheduling UI — Position Detail Page

**Goal:** Add an "Interviews" tab to the position detail page where any pipeline role can schedule Live and AI interviews for shortlisted candidates.

#### Design Vision
- Clean tab alongside existing "Resumes", "AI Insights" tabs on the position detail page
- Candidate selector shows only candidates from **that position's resume pipeline** (not global)
- Single modal/sheet with two modes:
  - 🎤 **Live Interview** → pick interviewer from org team, date/time, duration
  - 🤖 **AI Interview** → one-click, generates magic link, sends email

#### Tasks

- [ ] **2.1** Add `Interviews` tab to position detail page layout
- [ ] **2.2** Create `InterviewScheduler` component:
  - Candidate combobox (filterable, shows name + email + AI rank score)
  - Toggle: "Live" vs "AI" interview mode
  - **Live mode:** Interviewer selector (org team members), date picker, time picker, duration, notes
  - **AI mode:** Difficulty selector, duration, auto-generate magic link
  - Submit button → calls server action
- [ ] **2.3** Create server action `scheduleInterview`:
  - **Live mode:** Creates `Interview` record with `interviewMode: HUMAN`, `positionId`, `organizationId`, `scheduledById`
  - **AI mode:** Creates `AiInterviewSession` + generates `magicLinkToken`
  - Permission check: `canScheduleInterview`
  - Log to `AuditLog`
- [ ] **2.4** Create `ScheduledInterviewsPanel` — lists all interviews for the position:
  - Card/row per interview: candidate name, type badge (Live/AI), date, status, interviewer
  - AI interviews: magic link copy button, score if completed
  - Live interviews: interviewer name, date/time
  - Status badges: Scheduled → In Progress → Completed / Cancelled
- [ ] **2.5** Add per-position interview counts to `PositionsTable` (e.g., "3 scheduled · 1 completed")

#### Validation
- Position detail → Interviews tab → schedule a Live interview → appears in list
- Position detail → Interviews tab → schedule an AI interview → magic link generated
- `INTERVIEWER`-only user cannot see the "Schedule" button

---

## Story 3: Interviews Dashboard (Org-Wide View)

**Goal:** Add `/org-admin/interviews` page showing all interviews across all positions.

#### Design Vision
- Filterable table with stats banner
- Quick-glance metrics: Total | Scheduled | In Progress | Completed | Cancelled
- Click row → jump to position detail Interviews tab

#### Tasks

- [ ] **3.1** Create `/org-admin/interviews/page.tsx` — server component
  - Query: `Interview` (live) + `AiInterviewSession` (AI) for the org
  - Scope by `scopedDeptIds` for `DEPT_ADMIN`
- [ ] **3.2** Add "Interviews" sidebar nav link (calendar icon, between Positions and Reviews)
- [ ] **3.3** Build `InterviewsTable` client component:
  - Columns: Candidate | Position | Type (Live/AI) | Interviewer | Date | Status | Score
  - Filter tabs: All · Scheduled · In Progress · Completed
  - Search by candidate name/email
- [ ] **3.4** Stats banner with color-coded counts
- [ ] **3.5** Row click → navigate to `/org-admin/positions/[positionId]#interviews`

#### Validation
- Schedule 2 live + 2 AI interviews → see all 4 in dashboard
- Filter by status → correct filtering
- `DEPT_ADMIN` → only own dept interviews visible

---

## Story 4: Candidate-Side Interview Experience

**Goal:** Candidates can see and take their scheduled interviews.

#### Tasks

- [ ] **4.1** Email notifications via Resend when interview is scheduled:
  - Live: date/time confirmation email
  - AI: magic link email to start interview
- [ ] **4.2** Update `/candidate/dashboard` to show upcoming + past interviews:
  - Upcoming: date, position, type, "Join" or "Start AI Interview" button
  - Past: score (if AI), feedback summary (if live)
- [ ] **4.3** Verify AI interview magic link flow still works end-to-end:
  - Candidate clicks link → `/ai-interview/[token]` → starts session → completes → score saved
- [ ] **4.4** Interview status auto-updates:
  - AI session completes → `AiInterviewSession.status = COMPLETED`
  - Show real-time status in org-admin dashboard

#### Validation
- Schedule AI interview → candidate gets email → clicks link → completes → org admin sees score
- Schedule live interview → candidate sees it on dashboard with date/time

---

## Story 5: Interviewer-Side Experience (Org Context)

**Goal:** Org team members with `INTERVIEWER` role see their assigned interviews.

#### Tasks

- [ ] **5.1** Refactor `/interviewer/dashboard` to show org-context interviews (not just global)
- [ ] **5.2** Add "My Interviews" section: upcoming interviews assigned to this user
  - Show: candidate name, position, date/time, notes from scheduler
- [ ] **5.3** Post-interview: submit `InterviewFeedback` form (rating, recommendation, notes, summary)
- [ ] **5.4** Org admin can view submitted feedback on the position's Interviews panel

#### Validation
- Schedule live interview with Interviewer X → X sees it on their dashboard
- Interviewer submits feedback → org admin sees it on position Interviews tab

---

## Story 6: Database Schema Adjustments

**Goal:** Add missing fields to support interview scheduling from org-admin context.

#### Tasks

- [ ] **6.1** Add to `Interview` model:
  - `positionId String?` — links interview to position
  - `organizationId String?` — org scoping
  - `scheduledById String?` — who scheduled it (recruiter/HM, not the interviewer)
  - Add relations + indexes
- [ ] **6.2** Verify `AiInterviewSession` already has `positionId` + `organizationId` (it does ✅)
- [ ] **6.3** Run `npx prisma db push` — verify clean migration
- [ ] **6.4** Generate fresh Prisma client

#### Validation
- `npx prisma db push` runs without errors
- `npx prisma studio` shows new fields on Interview model

---

## Implementation Order

```
Story 0 (Cleanup)     →  Story 6 (Schema)    →  Story 1 (RBAC)
                                                       ↓
                                                 Story 2 (Scheduling UI)
                                                       ↓
                                                 Story 3 (Dashboard)
                                                       ↓
                                            ┌──────────┴──────────┐
                                      Story 4 (Candidate)   Story 5 (Interviewer)
```

> Stories 4 and 5 can run in parallel once Story 3 is complete.

---

## Complete Page × Role Matrix (Verification Checklist)

When all stories are done, this is the expected access for each role:

| Page | `ORG_ADMIN` | `DEPT_ADMIN` | `RECRUITER` | `HIRING_MGR` | `INTERVIEWER` |
|---|:---:|:---:|:---:|:---:|:---:|
| `/org-admin/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/org-admin/positions` | ✅ All | ✅ Own dept | ✅ Own dept | ✅ Own dept | ❌ Redirect |
| `/org-admin/positions/[id]` | ✅ | ✅ Dept check | ✅ Dept check | ✅ Dept check | ❌ Redirect |
| `/org-admin/positions/new` | ✅ | ✅ | ✅ | ✅ | ❌ Redirect |
| `/org-admin/resumes/[id]` | ✅ | ✅ Dept check | ✅ Dept check | ✅ Dept check | ❌ Redirect |
| `/org-admin/interviews` | ✅ All | ✅ Own dept | ✅ Own dept | ✅ Own dept | ✅ Own only |
| `/org-admin/reviews` | ✅ All | ✅ Own dept | ✅ Own dept | ✅ Own dept | ❌ Redirect |
| `/org-admin/invites` | ✅ | ✅ | ❌ Redirect | ❌ Redirect | ❌ Redirect |
| `/org-admin/team` | ✅ | ✅ Scoped | ❌ Redirect | ❌ Redirect | ❌ Redirect |
| `/org-admin/departments` | ✅ | ❌ Redirect | ❌ Redirect | ❌ Redirect | ❌ Redirect |
| `/org-admin/billing` | ✅ | ❌ Redirect | ❌ Redirect | ❌ Redirect | ❌ Redirect |
| `/org-admin/settings` | ✅ | ❌ Redirect | ❌ Redirect | ❌ Redirect | ❌ Redirect |
| `/org-admin/activity` | ✅ | ❌ Redirect | ❌ Redirect | ❌ Redirect | ❌ Redirect |

---

## Out of Scope (Phase 2+)

- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Video conferencing auto-setup (LiveKit rooms)
- [ ] Automated scheduling based on availability
- [ ] Configurable scoring rubrics per-position
- [ ] Phase 2 RBAC tightening (see `RBAC_MATRIX.md` §3d)
- [ ] Bulk interview scheduling for multiple candidates
- [ ] Interview reminders and follow-up emails
