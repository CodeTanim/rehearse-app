"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import {
  MAXIMUM_PASSWORD_LENGTH,
  MINIMUM_PASSWORD_LENGTH,
  registerSchema,
  type RegisterInput,
} from "@/lib/auth/validation"

type RegisterErrors = Partial<Record<keyof RegisterInput | "general", string>>

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterInput>({
    name: "",
    email: "",
    password: "",
  })
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = registerSchema.safeParse(formData)

    if (!result.success) {
      const fieldErrors: RegisterErrors = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0]
        if (field === "name" || field === "email" || field === "password") {
          fieldErrors[field] = issue.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...result.data,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      router.replace("/auth/login?registered=1")
    } catch (error) {
      setErrors({ general: (error as Error).message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined, general: undefined }))
  }

  return (
    <AuthLayout title="Create account">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {errors.general && (
          <Alert role="alert" variant="destructive" className="text-sm font-semibold text-destructive">
            {errors.general}
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
              Name
            </label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={80}
              value={formData.name}
              onChange={handleChange}
              error={errors.name}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              showRequirements={true}
              minimumLength={MINIMUM_PASSWORD_LENGTH}
              minLength={MINIMUM_PASSWORD_LENGTH}
              maxLength={MAXIMUM_PASSWORD_LENGTH}
              required
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Create account
        </Button>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-link underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
