/**
 * Intake Window — Shared utility for checking position intake status.
 *
 * The intake window starts when the position is created and lasts
 * for `intakeWindowDays` days. After that, applications are rejected.
 */

interface IntakePosition {
  isPublished: boolean
  createdAt: Date
  intakeWindowDays: number
}

/** Returns the exact date/time when intake closes */
export function intakeClosesAt(pos: Pick<IntakePosition, "createdAt" | "intakeWindowDays">): Date {
  const closes = new Date(pos.createdAt)
  closes.setDate(closes.getDate() + pos.intakeWindowDays)
  return closes
}

/** Returns true if the position is still accepting applications */
export function isIntakeOpen(pos: IntakePosition): boolean {
  if (!pos.isPublished) return false
  return new Date() < intakeClosesAt(pos)
}

/** Returns the number of full days remaining in the intake window (0 if closed) */
export function daysRemaining(pos: Pick<IntakePosition, "createdAt" | "intakeWindowDays">): number {
  const closes = intakeClosesAt(pos)
  const diff = closes.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
