const REVIEW_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidTimeZone(timeZone: string) {
  if (!timeZone || timeZone.length > 100) return false

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0)
    return true
  } catch {
    return false
  }
}

/** Returns the learner-local calendar day while the occurrence remains UTC. */
export function toReviewDay(date: Date, timeZone: string) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError("date must be a valid Date.")
  }
  if (!isValidTimeZone(timeZone)) {
    throw new RangeError("timeZone must be a valid IANA timezone.")
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return `${values.year}-${values.month}-${values.day}`
}

export function differenceInReviewDays(earlier: string, later: string) {
  const earlierTimestamp = reviewDayToUtcTimestamp(earlier)
  const laterTimestamp = reviewDayToUtcTimestamp(later)
  return Math.max(0, Math.round((laterTimestamp - earlierTimestamp) / 86_400_000))
}

function reviewDayToUtcTimestamp(reviewDay: string) {
  const match = REVIEW_DAY_PATTERN.exec(reviewDay)
  if (!match) throw new RangeError("reviewDay must use YYYY-MM-DD.")

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("reviewDay must be a real calendar date.")
  }

  return timestamp
}
