"use client"

import { useState } from "react"
import Link from "next/link"
import { AuthLayout } from "@/components/auth/auth-layout"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { z } from "zod"

const resetSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Validate email
      resetSchema.parse({ email })

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Password reset failed")
      }

      setSuccess(true)
    } catch (error) {
      if (error instanceof z.ZodError) {
        setError(error.issues[0].message)
      } else {
        setError((error as Error).message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <AuthLayout 
        title="Check your email"
        subtitle="Password reset instructions sent"
      >
        <div className="text-center space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-700">
              If an account with that email exists, we&apos;ve sent you a password reset link.
            </p>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Check your email for a link to reset your password. If it doesn&apos;t appear within a few minutes, check your spam folder.
          </p>
          
          <div className="pt-4">
            <Link 
              href="/auth/login" 
              className="text-sm text-primary hover:text-primary/80"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout 
      title="Reset your password"
      subtitle="Enter your email to receive reset instructions"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 text-sm error-text bg-destructive/10 border border-destructive/20 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
            Email Address
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError("")
            }}
            placeholder="Enter your email"
            required
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Send Reset Instructions
        </Button>

        <div className="text-center">
          <Link 
            href="/auth/login" 
            className="text-sm text-primary hover:text-primary/80"
          >
            ← Back to sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  )
}