# Project Roadmap 3 — Enterprise Multi-Tenant Architecture & RBAC (Role-Based Access Control)

## Goal
To architect and implement a secure, scalable, and foolproof multi-tenant architecture for IQMela. This will empower enterprise clients to manage their organizations, assign granular roles (Admin, Billing, Recruiter, Interviewer, Hiring Manager), securely invite candidates without forcing them to register, and maintain 360-degree audit compliance. 

The user experience should be **Tesla-like**: minimalist, deeply intuitive, zero-clutter, and context-aware. Users seamlessly interact with their Organization workspace and the global IQMela Marketplace without friction.

---

## Technical Stack & Prerequisites

Before starting execution, we will install and configure the following additions to our tech stack:

1. **Clerk B2B SaaS Features**: Leveraging Clerk Organizations to handle tenant isolation, user invitations, and base RBAC.
   - *Install*: No new package, but requires enabling "Organizations" in the Clerk Dashboard.
2. **Prisma Audit Trail**: A robust database logging mechanism for 360-degree security compliance.
3. **Zod & Server Actions Security**: Strict request validation layer enforcing tenant boundaries. We will strictly use `req.auth.orgId` on the server.

---

## Architectural Vision: The "Tesla-Like" Experience

1. **Context-Aware Dashboard**: When a user logs in, the platform immediately knows their role. A Recruiter sees candidate pipelines; a Hiring Manager sees final review cards; an Org Admin sees the high-level metrics and billing. 
2. **Frictionless Candidate Experience**: Candidates never create passwords or accounts. They join interviews via secure, one-time-use cryptographic magic links, lowering drop-off rates to zero.
3. **Global vs. Local**: The **IQMela Marketplace** (global assessments, AI templates) sits seamlessly alongside **Org-Specific Content** (custom positions, extracted resumes).
4. **Frictionless Tenant Switching**: If an agency user belongs to multiple organizations, they use a highly polished workspace switcher (CMD+K / dropdown) without page reloads.
5. **Zero-Trust Backend**: Every API route and Server Action validates the user's role against the targeted resource's `tenantId`.

## Roles & Privileges Matrix

| Role | Privileges & Workflow | Who Assigns This Role? |
|------|-----------------------|-------------------------|
| **Org Admin** | Full access. Manages users, overrides settings. Pays bills. | Initial Creator (Founder) / Another Org Admin |
| **Org Billing Admin** | Access to Stripe, subscription management. No access to PII. | Org Admin |
| **Recruiter** | Creates positions, uploads resumes, runs bulk extractions, invites candidates. | Org Admin |
| **Hiring Manager** | Reviews transcripts/scores, makes hiring decisions. Scoped to Departments. | Org Admin / Recruiter |
| **Interviewer** | Unlocks specific candidate scorecards to review or join live sessions. | Org Admin / Recruiter |

---

## Implementation Steps (Step-by-Step Chunks)

### Phase 1: Database & Tenant Foundation (The Vault)
*Ensuring the database schema is foolproof and multi-tenant ready.*

**Step 301 — Introduce `tenantId` & Organization Schema**
- Update `schema.prisma` to add `organizationId` (mapped from Clerk `orgId`) to all core models: `Position`, `Candidate`, `Resume`, `AiInterviewSession`.
- Add composite indexes for efficient querying: `@@index([organizationId, createdAt])`.
- Run `prisma db push`.

**Step 302 — Department Mapping (The Org Chart)**
- Create a `Department` schema in Prisma mapped to the `organizationId`.
- Allow linking `Position` and `User` (Hiring Managers/Interviewers) to specific Departments to isolate visibility in larger enterprises.

**Step 303 — Create the `AuditLog` Model**
- Add an `AuditLog` table: `id, organizationId, userId, action, resourceType, resourceId, metadata, createdAt`.
- Ensures 360-degree compliance. Every critical action is logged immutably.

**Step 304 — Soft Deletes & DB Immutability**
- Modify Prisma to use soft deletes (`isDeleted: Boolean`, `deletedAt: DateTime`) for critical records to preserve audit integrity over time.

### Phase 2: Role Management, Invitations & Billing Sync (The Bouncer)
*Clerk Organizations, User Invitations, and Tier Limits.*

**Step 305 — Configure Clerk Organization Roles**
- Setup Custom Roles in Clerk Dashboard: `org:admin`, `org:billing_admin`, `org:recruiter`, `org:hiring_manager`, `org:interviewer`.

**Step 306 — User Invitation & Role Setup UI (Org Admin Task)**
- Build the "Team Settings" UI utilizing Clerk components.
- Outline workflow: The Org Admin enters an email and clicks "Invite as Billing Admin" or "Invite as Recruiter."
- The invitee receives an email, clicks to accept, and cleanly joins the tenant workspace.

**Step 307 — Subscription Boundaries & Enforcement**
- Hook up the backend to check active subscription tier (paid by Org Admin or Billing Admin).
- When a Recruiter tries to initiate 500 AI Bulk Extractions, the server verifies token quota against the org's Stripe balance before executing.

**Step 308 — Middleware Security Barrier**
- Update Next.js `middleware.ts`.
- Enforce that restricted routes map correctly to the active Clerk `.orgId`.
- Seamlessly redirect unauthorized access to standard onboarding routes.

### Phase 3: The "Tesla-Like" UI/UX Shell (The Cockpit)
*Building the frictionless interface for B2B users.*

**Step 309 — Universal App Shell with Workspace Switcher**
- Implement a sleek side-nav/top-nav featuring Clerk `<OrganizationSwitcher />`.
- Context-aware navigation map dynamically filters sidebar items based on the active role.

**Step 310 — Role-Based Routing & Protections**
- Create HOCs/Server checks: e.g., `<Protect role="org:billing_admin"> ... </Protect>`.
- Elements disappear fully if forbidden (no cluttered grayed-out buttons).

### Phase 4: Workflow Specialization (The Persona Engine)
*Tailoring the experience for specific personas.*

**Step 311 — Recruiter & Org Admin Dashboards**
- Active Positions / Pending Inferences. Quick-action floating widgets.

**Step 312 — Hiring Manager & Interviewer Views**
- Hyper-streamlined `/reviews` workflow showing final candidate scorecards and recordings.
- Complete removal of platform settings/billing tools from this view.

**Step 313 — Billing Admin Dashboard**
- `/billing` route accessible *only* to `org:admin` and `org:billing_admin`.

### Phase 5: Frictionless Candidate Experience (Zero-Auth Flow)
*Handling external candidates without forcing registration.*

**Step 314 — Secure Magic Link Generation**
- When a Recruiter invites a Candidate, the system generates a cryptographic, one-time token (`InterviewSession.accessToken`) saved in the database.
- Send automated email: `iqmela.com/interview/session_123?token=XYZ...`

**Step 315 — The Unauthenticated Lobby Route (`/interview/[id]`)**
- Bypass Clerk protections for this specific route.
- Candidate verifies Name, adjusts Camera/Mic, and agrees to ToS natively in the UI. **Zero password creation.**

**Step 316 — Token Lifecycle Management**
- Validate token server-side before starting WebRTC/Orb AI.
- Once interview finishes or times out, strike the token (`status = 'completed'`), preventing replay attacks.
- All scores and artifacts securely flow back to the parent `organizationId`.

### Phase 6: Audit & Compliance Finalization (The Black Box)

**Step 317 — Implement `withAudit` Server Action Wrapper**
- Autologging utility utilizing `req.auth.userId` and `req.auth.orgId`. Example: `withAudit(createPosition)`

**Step 318 — Audit Trail UI (Org Admin Only)**
- Build an `/org/audit-logs` datatable for enterprise compliance.

---
> 🚀 **Next Steps:** Once you review and approve this roadmap, we will move to the execution phase starting with **Step 301 (The Vault)**.
