"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"

type LoginFormProps = {
  registered: boolean
  returnTo: string
}

export function LoginForm({ registered, returnTo }: LoginFormProps) {
  const [formData, setFormData] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const { login, isLoading } = useAuth()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")

    if (!formData.email || !formData.password) {
      setError("Enter your email and password.")
      return
    }

    const result = await login(formData.email, formData.password, returnTo)
    if (result.error) setError(result.error)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    if (error) setError("")
  }

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {registered && (
          <Alert role="status" variant="success" className="text-sm">
            Account created.
          </Alert>
        )}

        {error && (
          <Alert role="alert" variant="destructive" className="text-sm font-semibold text-destructive">
            {error}
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              Email address
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={formData.email}
              onChange={handleChange}
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
              autoComplete="current-password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <Link
          href="/auth/reset-password"
          className="inline-block text-sm text-link underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>

        <Button type="submit" className="w-full" isLoading={isLoading} disabled={isLoading}>
          Sign in
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-link underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
