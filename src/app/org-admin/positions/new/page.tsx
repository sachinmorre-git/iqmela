import { Button } from "@/components/ui/button"
import Link from "next/link"
import { createPosition } from "./actions"

export const metadata = {
  title: "New Position | Org Admin | IQMela",
  description: "Post a new open position for your organisation.",
}

const INPUT_CLS =
  "w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"

const LABEL_CLS = "block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2"

export default function NewPositionPage() {
  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Back link + header */}
      <div className="mb-8">
        <Link
          href="/org-admin/positions"
          className="text-sm text-teal-600 dark:text-teal-400 hover:underline mb-4 inline-block"
        >
          ← Back to Positions
        </Link>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Post New Position
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-base">
          Fill in the details below to create a new open role.
        </p>
      </div>

      {/* Form card */}
      <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 md:p-8">
        {/*
          action will be wired to a Server Action in Step 60.
          For now the form is UI-only.
        */}
        <form action={createPosition} className="space-y-6">

          {/* ── Title ───────────────────────────────────────── */}
          <div>
            <label htmlFor="title" className={LABEL_CLS}>
              Position Title <span className="text-red-500">*</span>
            </label>
            <input
              required
              id="title"
              name="title"
              type="text"
              placeholder="e.g. Senior Frontend Engineer"
              className={INPUT_CLS}
            />
          </div>

          {/* ── Department · Location · Employment Type ────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label htmlFor="department" className={LABEL_CLS}>
                Department
              </label>
              <input
                id="department"
                name="department"
                type="text"
                placeholder="e.g. Engineering"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="location" className={LABEL_CLS}>
                Location
              </label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="e.g. Remote / NYC"
                className={INPUT_CLS}
              />
            </div>

            <div>
              <label htmlFor="employmentType" className={LABEL_CLS}>
                Employment Type
              </label>
              <select
                id="employmentType"
                name="employmentType"
                defaultValue=""
                className={INPUT_CLS}
              >
                <option value="" disabled className="dark:bg-zinc-800">
                  Select type…
                </option>
                <option value="FULL_TIME" className="dark:bg-zinc-800">Full-time</option>
                <option value="PART_TIME" className="dark:bg-zinc-800">Part-time</option>
                <option value="CONTRACT"  className="dark:bg-zinc-800">Contract</option>
                <option value="INTERNSHIP" className="dark:bg-zinc-800">Internship</option>
              </select>
            </div>
          </div>

          {/* ── Status ──────────────────────────────────────── */}
          <div className="w-full md:w-1/3">
            <label htmlFor="status" className={LABEL_CLS}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue="DRAFT"
              className={INPUT_CLS}
            >
              <option value="DRAFT"    className="dark:bg-zinc-800">Draft</option>
              <option value="OPEN"     className="dark:bg-zinc-800">Open</option>
              <option value="PAUSED"   className="dark:bg-zinc-800">Paused</option>
              <option value="CLOSED"   className="dark:bg-zinc-800">Closed</option>
              <option value="ARCHIVED" className="dark:bg-zinc-800">Archived</option>
            </select>
          </div>

          {/* ── Short Description ────────────────────────────── */}
          <div>
            <label htmlFor="description" className={LABEL_CLS}>
              Short Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="A brief, public-facing summary shown to candidates on the listings page."
              className={INPUT_CLS}
            />
          </div>

          {/* ── JD Text ─────────────────────────────────────── */}
          <div>
            <label htmlFor="jdText" className={LABEL_CLS}>
              Full Job Description
            </label>
            <textarea
              id="jdText"
              name="jdText"
              rows={10}
              placeholder={`Paste or write the full job description here.\n\nYou can include:\n• Responsibilities\n• Requirements\n• Tech stack\n• Benefits`}
              className={INPUT_CLS}
            />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
              This text will also be used for AI-powered resume ranking in a later step.
            </p>
          </div>

          {/* ── Actions ─────────────────────────────────────── */}
          <div className="pt-2 flex flex-col sm:flex-row justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              asChild
            >
              <Link href="/org-admin/positions">Cancel</Link>
            </Button>
            <Button
              type="submit"
              className="rounded-xl shadow-md shadow-teal-600/20 bg-teal-600 hover:bg-teal-700 text-white border-transparent hover:-translate-y-0.5 transition-transform"
            >
              Save Position
            </Button>
          </div>

        </form>
      </div>
    </div>
  )
}
