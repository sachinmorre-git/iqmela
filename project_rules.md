# IQMela-v2 AI Hiring Workflow Implementation Rules

We are extending the existing **Interview Platform (IQMela-v2)** by implementing the **AI layer for the Organization Hiring Workflow** under the **org admin experience**, in very small, incremental steps.

## Scope and Change Control

* Do **only** the exact step I provide.
* Do **not** add extra features, assumptions, future functionality, or jump ahead to later steps.
* Build in **very small, independently testable** steps.
* Every step must produce either:

  * a **visible UI change in the browser**, or
  * a **clearly testable backend result**.

## Safety and Compatibility

* Do **not break** any existing candidate, interviewer, admin, org admin, scheduling, resume upload, interview room, or interview flows.
* Reuse the existing project architecture, design system, layouts, cards, forms, tables, route protection, auth system, and role system.
* Keep **human review in the loop** at all times; AI only assists and is **not the final source of truth**.

## Technical Standards

* Use:

  * **TypeScript**
  * **Next.js App Router** (`app/` directory)
  * **Tailwind CSS**
  * **shadcn/ui-style components** where appropriate
* Keep all code **production-minded, modular, cleanly structured, and logically organized**.
* Prefer **database-backed implementation once the UI shell is complete**.

## AI Layer Rules

* Use **Gemini** as the **primary AI provider**.
* Keep the AI provider behind a **service abstraction** so it can be replaced later.
* Preserve a **safe fallback** when no Gemini API key is configured.
* Use **structured JSON output** wherever possible.
* **Validate and normalize** AI outputs before showing them in the UI.
* Build **resume parsing, ranking, and email extraction** as **separate service layers**.
* Prefer **low-cost or free-quota friendly API design**.

## Secrets and Configuration

* Never hardcode API keys or secrets.
* Store secrets and config only in **environment variables**.

## Required Output After Every Step

After every step, output exactly these 6 items:

1. Files changed
2. Commands to run
3. URL/path to open (**must be a clickable hyperlink**)
4. What should appear on screen
5. How to validate success
6. Which environment variables are required for this step
7. Do not jump ahead.
8. Do not build future steps.
9. Complete only this step in a fully testable way.

