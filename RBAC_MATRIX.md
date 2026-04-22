# IQMela — Role-Based Access Control Matrix

> **Last Updated:** 2026-04-17  
> **Owner:** Sachin More  
> **Status:** 🔶 Draft — Awaiting Review  
> **Philosophy:** Ship simple for small companies NOW. The framework is ready to tighten per-role later.

This document defines every role, its scope, and its exact privileges across the entire IQMela platform.  
It is the **single source of truth** that `src/lib/rbac.ts` and all route guards must conform to.

---

## 1. Platform Tiers

IQMela has **three distinct access tiers**, each completely isolated:

| Tier | Route Prefix | Auth Boundary | Description |
|------|-------------|---------------|-------------|
| **God Mode** (IQMela Internal) | `/admin/*` | `sysRole` in Clerk `publicMetadata` | IQMela employees managing the platform itself |
| **Client Org** (B2B Tenants) | `/org-admin/*` | Clerk Org + Postgres `roles[]` | Enterprise clients managing their own hiring |
| **Open Marketplace** | `/candidate/*`, `/interviewer/*` | Postgres `roles[]` | Individual users who sign up independently |

---

## 2. God Mode — IQMela Internal Staff

These roles are for **IQMela employees only**. They are NOT stored in the Prisma `Role` enum.  
They are set via Clerk `publicMetadata.sysRole` by a Super Admin.

| Permission | `sys:superadmin` | `sys:finance` | `sys:support` | `sys:developer` / `sys:qa` |
|---|:---:|:---:|:---:|:---:|
| **Global Overview Dashboard** | ✅ | ✅ | ❌ | ✅ |
| **Economics & Billing** | ✅ | ✅ | ❌ | ❌ |
| **Client Support** | ✅ | ❌ | ✅ | ❌ |
| **Deploy Sandboxes (Onboarding)** | ✅ | ❌ | ✅ | ❌ |
| **Dev Ops & Health** | ✅ | ❌ | ❌ | ✅ |
| **Manage sysRoles for staff** | ✅ | ❌ | ❌ | ❌ |
| **Impersonate client orgs** | ✅ | ❌ | ✅ | ❌ |

---

## 3. Client Org — B2B Tenant Roles

These roles exist inside Prisma `Role` enum and are stored as `roles: Role[]` (multi-role array).  
A user **can hold multiple roles** simultaneously (e.g., Recruiter + Hiring Manager).  
Data is scoped by `organizationId` and optionally by `departmentId`.

### 3a. Organisation-Level Administration

| Permission | `ORG_ADMIN` | `DEPT_ADMIN` |
|---|:---:|:---:|
| **Access `/org-admin` portal** | ✅ | ✅ (scoped) |
| **View Dashboard** | ✅ | ✅ |
| **Manage Team (invite/edit/remove)** | ✅ All members | ✅ Own dept members only |
| **Create / Delete Departments** | ✅ | ❌ |
| **Manage Billing & Settings** | ✅ | ❌ |
| **View Activity Log** | ✅ | ❌ |
| **Invite members — assignable roles** | All roles below self | `RECRUITER`, `HIRING_MANAGER`, `INTERVIEWER` |
| **Invite members — assignable depts** | All departments | Own departments only |
| **See all org members in Team table** | ✅ Full access | ✅ Visible, but out-of-dept greyed out |

### 3b. Hiring Pipeline (Simplified — Phase 1)

> **Note:** For Phase 1 (small/mid companies), `RECRUITER` and `HIRING_MANAGER` share identical privileges.  
> All org roles can conduct interviews and submit feedback.  
> Privileges will be tightened per-role in Phase 2 when enterprise clients require it.

| Permission | `ORG_ADMIN` | `DEPT_ADMIN` | `RECRUITER` | `HIRING_MANAGER` | `INTERVIEWER` |
|---|:---:|:---:|:---:|:---:|:---:|
| | | | | | |
| **── Positions ──** | | | | | |
| View Positions | ✅ All | ✅ Own dept | ✅ Own dept | ✅ Own dept | ❌ |
| Create / Edit Positions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete / Archive Positions | ✅ | ✅ | ✅ | ✅ | ❌ |
| | | | | | |
| **── Resumes & AI ──** | | | | | |
| Upload Resumes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Run AI Extraction | ✅ | ✅ | ✅ | ✅ | ❌ |
| Run AI Ranking | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Ranked Candidates | ✅ | ✅ | ✅ | ✅ | ❌ |
| | | | | | |
| **── Interview Scheduling ──** | | | | | |
| Schedule Live Interview with Candidate | ✅ | ✅ | ✅ | ✅ | ❌ |
| Schedule AI Interview for Candidate | ✅ | ✅ | ✅ | ✅ | ❌ |
| | | | | | |
| **── Conducting Interviews ──** | | | | | |
| Conduct Live Interviews | ✅ | ✅ | ✅ | ✅ | ✅ |
| Conduct AI Interviews (as observer) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit Interview Feedback / Scores | ✅ | ✅ | ✅ | ✅ | ✅ |
| View Interview Results | ✅ | ✅ | ✅ | ✅ | ✅ Own only |
| | | | | | |
| **── Decisions ──** | | | | | |
| Make Hire / Reject Decision | ✅ | ✅ | ✅ | ✅ | ❌ |

### 3c. Data Scoping Rules

| Rule | Description |
|---|---|
| **ORG_ADMIN** | `scopedDeptIds = null` → sees ALL data across all departments |
| **DEPT_ADMIN** | `scopedDeptIds = [own dept IDs]` → only sees positions, resumes, candidates within assigned departments |
| **RECRUITER / HIRING_MANAGER** | Same scoping as DEPT_ADMIN — limited to their assigned departments |
| **INTERVIEWER** | Only sees interviews they are assigned to. No department-level browsing |
| **Department Deletion** | Blocked if any members are still assigned. Must reassign first |
| **"Invite Down" Rule** | You can only assign roles at or below your own tier. `ORG_ADMIN` can assign anything. `DEPT_ADMIN` cannot assign `ORG_ADMIN` or `DEPT_ADMIN` |

### 3d. Phase 2 Tightening (Future — When Enterprise Clients Need It)

These restrictions are **NOT enforced yet**. They are documented here for when we need to split privileges:

| Change | From (Phase 1) | To (Phase 2) |
|---|---|---|
| Resume Upload | All org roles | `RECRUITER` only |
| AI Extraction / Ranking | All org roles | `RECRUITER` + `ORG_ADMIN` |
| Conduct Interviews | All org roles | `INTERVIEWER` only |
| Hire/Reject Decision | All org roles | `HIRING_MANAGER` + `ORG_ADMIN` only |
| Schedule Interviews | All org roles | `RECRUITER` + `HIRING_MANAGER` |

---

## 4. Open Marketplace — Independent Users

These users sign up directly on IQMela (not through a client org invite).  
They do NOT belong to any `organizationId`. They have their own standalone dashboards.

### 4a. Candidate (`CANDIDATE`)

| Permission | Access |
|---|---|
| **Route** | `/candidate/*` |
| **View own dashboard** | ✅ |
| **Edit own profile** | ✅ |
| **Take AI-powered interviews** | ✅ (via invite link or open assessment) |
| **View own interview results** | ✅ |
| **View own assessments** | ✅ |
| **Apply to open positions** | ✅ (future — marketplace) |
| **Browse other candidates** | ❌ |
| **Access org-admin portal** | ❌ |

### 4b. Interviewer (`INTERVIEWER`)

| Permission | Access |
|---|---|
| **Route** | `/interviewer/*` |
| **View own dashboard** | ✅ |
| **Edit own profile** | ✅ |
| **View assigned candidates** | ✅ |
| **Schedule interviews** | ✅ |
| **Conduct live interviews** | ✅ |
| **Submit feedback / scores** | ✅ |
| **Browse all candidates** | ❌ Only assigned ones |
| **Access org-admin portal** | ❌ |

---

## 5. Role Hierarchy (Privilege Escalation Prevention)

```
  ┌─────────────────────────────────────────────────────┐
  │                    GOD MODE                         │
  │  sys:superadmin → sys:finance / support / developer │
  └──────────────────────┬──────────────────────────────┘
                         │ (completely separate boundary)
  ┌──────────────────────▼──────────────────────────────┐
  │               CLIENT ORG TIER                       │
  │                                                     │
  │  ORG_ADMIN                                          │
  │    └── DEPT_ADMIN                                   │
  │          ├── RECRUITER      ← same privileges (v1)  │
  │          ├── HIRING_MANAGER ← same privileges (v1)  │
  │          └── INTERVIEWER                            │
  │                                                     │
  └──────────────────────┬──────────────────────────────┘
                         │ (completely separate boundary)
  ┌──────────────────────▼──────────────────────────────┐
  │            OPEN MARKETPLACE                         │
  │                                                     │
  │  CANDIDATE  (standalone, no org)                    │
  │  INTERVIEWER (standalone, no org)                   │
  └─────────────────────────────────────────────────────┘
```

---

## 6. Multi-Role Scenarios

| Scenario | `roles[]` | Effective Access |
|---|---|---|
| Startup founder doing everything | `[ORG_ADMIN, RECRUITER]` | Full org-admin + pipeline |
| HR lead managing a department | `[DEPT_ADMIN, RECRUITER]` | Manages dept team + runs hiring |
| Senior dev who also interviews | `[HIRING_MANAGER, INTERVIEWER]` | Reviews candidates + conducts interviews |
| External freelance interviewer | `[INTERVIEWER]` | Only sees assigned interviews |
| Candidate invited into an org | `[CANDIDATE]` (with `organizationId`) | Org-scoped candidate |

---

## 7. Implementation Reference

| Concern | File |
|---|---|
| Role enum definition | `prisma/schema.prisma` → `enum Role` |
| Permission engine | `src/lib/rbac.ts` → `getCallerPermissions()` |
| God Mode guard | `src/app/admin/layout.tsx` → `sysRole` check |
| Org Admin guard | `src/app/org-admin/layout.tsx` → `getCallerPermissions()` |
| Candidate guard | `src/app/candidate/layout.tsx` |
| Interviewer guard | `src/app/interviewer/layout.tsx` |
| Invite flow (roles assigned) | `src/app/org-admin/team/actions.ts` |
| Assignable roles logic | `src/lib/rbac.ts` → `getAssignableRoles()` |
