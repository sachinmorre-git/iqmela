# IQMela-v2 Production Email + AI Hiring Workflow Implementation Rules

Follow these rules for **every** implementation step.

---

## 1) Core Execution Rules

- Do **only** the exact step requested.
- Do **not** jump ahead.
- Do **not** add extra features, assumptions, shortcuts, or future functionality.
- Build in **very small, independently testable** steps.
- Each step must produce either:
  - a **visible UI/browser change**, or
  - a **clearly testable backend result**.
- Preserve all existing workflows unless the current step explicitly changes them.

---

## 2) Existing App Safety Rules

- Do **not break** any existing candidate, interviewer, admin, org admin, scheduling, resume upload, interview room, invite, or interview flow.
- Preserve existing **invite** and **org-admin** workflows.
- Reuse the current project architecture, route protection, auth system, role system, layouts, forms, cards, tables, and design patterns.
- Keep **human review in the loop** at all times; AI may assist, but it must **not** become the final source of truth.

---

## 3) Technical Standards

- Use **TypeScript**.
- Use **Next.js App Router** (`app/` directory).
- Use **Tailwind CSS**.
- Use **shadcn/ui-style components** where appropriate.
- Keep the implementation **production-minded, modular, clean, reusable, and logically organized**.
- Prefer **database-backed implementation** once the UI shell for that feature is complete.
- Keep code structured so future providers and modules can be swapped without major rewrites.

---

## 4) Email Architecture Rules

- Do **not** build or host a raw SMTP mail server inside the app.
- Use a **transactional email provider architecture** suitable for **Vercel deployment**.
- Build **all email sending logic on the server side only**.
- Use **environment variables** for all secrets and configuration.
- Make the email provider **easy to swap later** through a provider abstraction.
- Implement the **first real provider using Resend**.
- Keep the setup **Vercel-friendly** and easy to deploy.
- Add all required dependencies to `package.json`.
- Keep email templates **modular** and **reusable**.
- Use **React Email** templates where appropriate.
- Build the email layer in **small, testable steps**.

---

## 5) AI Layer Rules

- Use **Gemini** as the **primary AI provider**.
- Keep Gemini behind a **service abstraction** so it can be replaced later.
- Preserve a **safe fallback** when no Gemini API key is configured.
- Use **structured JSON output** wherever possible.
- **Validate and normalize** AI outputs before showing them in the UI.
- Build **resume parsing**, **ranking**, and **email extraction** as **separate service layers**.
- Prefer **low-cost or free-quota-friendly** API design.

---

## 6) Secrets and Configuration Rules

- Never hardcode API keys, tokens, credentials, or secrets.
- Store secrets and configuration **only in environment variables**.
- Make all configuration **Vercel-safe**.
- Keep the local development setup simple and the production deployment path clear.

---

## 7) Git Rules

- **Never** run `git add`, `git commit`, or `git push` automatically.
- After completing changes, always stop and ask exactly:

> Changes are ready. Shall I commit and push to git?

- Wait for **explicit approval** before running any git command.

---

## 8) Scope and Change Control Rules

- Complete **only** the current requested step.
- Do **not** implement future steps.
- Do **not** silently prepare hidden future infrastructure unless the current step directly requires it.
- Keep every step **independently testable**.

---

## 9) Required Output After Every Step

After every step, output **exactly** the following items in this order:

### 1. Files changed
- List every file created, modified, or deleted.
- Include a one-line description of what changed in each file.

### 2. Libraries added
- List every new dependency or dev dependency added in this step.
- Write `None` if not applicable.

### 3. Commands to run
- List the exact commands needed to install, generate, migrate, build, or run this step.

### 4. URL/path to open
- Provide the exact route, page, or API path to open.
- This **must be a clickable hyperlink** when applicable.

### 5. What should appear on screen
- Describe what the user should see in the UI,
- or what backend/test result should happen.

### 6. End-user impact
- Explain what is now different from the user’s perspective.
- State what they can now do, see, or experience that was not possible before.

### 7. How to validate success
- Give step-by-step validation instructions that a **non-technical person** can follow:
  - which URL to visit
  - what to click or do
  - what should happen on screen or in the result

### 8. Environment variables required
- List any new `.env` keys needed for this step.
- Write `None` if not applicable.

### 9. Whether this step is Vercel-safe
- State `Yes` or `No`.
- Add a one-line reason.

### 10. Stop condition
End every step with exactly:

- Do not jump ahead.
- Do not build future steps.
- Complete only this step in a fully testable way.

---

## 10) Implementation Behavior Rules

- Keep each step **visible** or **clearly testable**.
- Prefer modular files over large mixed-logic files.
- Keep provider-specific logic isolated from business logic.
- Keep server-only logic out of client components.
- Avoid fragile coupling between email, AI, and workflow logic.
- Preserve backward compatibility unless the step explicitly requires a controlled change.

---

## 11) Final Enforcement Rules

- Do only the exact requested step.
- Do not jump ahead.
- Do not build future steps.
- Do not break existing flows.
- Keep the architecture provider-agnostic where required.
- Keep the solution Vercel-friendly.
- Keep the implementation modular, testable, and production-minded.