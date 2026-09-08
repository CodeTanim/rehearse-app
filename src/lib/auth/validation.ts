import { z } from "zod"

export const MINIMUM_PASSWORD_LENGTH = 12
export const MAXIMUM_PASSWORD_LENGTH = 128

function isSupportedTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be 80 characters or fewer"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254, "Email address must be 254 characters or fewer"),
  password: z
    .string()
    .min(
      MINIMUM_PASSWORD_LENGTH,
      `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters`
    )
    .max(
      MAXIMUM_PASSWORD_LENGTH,
      `Password must be ${MAXIMUM_PASSWORD_LENGTH} characters or fewer`
    ),
  timezone: z
    .string()
    .trim()
    .max(100)
    .refine(isSupportedTimeZone, "Choose a valid timezone")
    .optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
