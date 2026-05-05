"use client"

export function SelectAllCheckbox() {
  return (
    <input
      type="checkbox"
      title="Select all actionable candidates"
      className="w-4 h-4 rounded border-gray-300 dark:border-zinc-700 text-rose-600 focus:ring-rose-600 dark:bg-zinc-800 cursor-pointer shadow-sm"
      onChange={(e) => {
        const form = e.target.closest('form')
        if (form) {
          const checkboxes = form.querySelectorAll<HTMLInputElement>('input[name="resumeIds"]')
          checkboxes.forEach(cb => cb.checked = e.target.checked)
        }
      }}
    />
  )
}
