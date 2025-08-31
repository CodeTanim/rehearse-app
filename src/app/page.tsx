"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* Logo/Brand */}
          <div>
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground font-bold text-xl">R</span>
              </div>
              <h1 className="text-4xl font-bold text-foreground">Rehearse</h1>
            </div>
            <p className="mt-2 text-lg text-muted-foreground">
              Skill Retention Platform
            </p>
          </div>

          {/* Hero Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-foreground">
              Prevent Knowledge Decay
            </h2>
            <p className="text-muted-foreground">
              Track your skills, practice with intelligent reminders, and maintain your knowledge before it fades.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-4">
            <div className="space-y-3">
              <Link href="/auth/register" className="w-full">
                <Button className="w-full" size="lg">
                  Get Started
                </Button>
              </Link>
              
              <Link href="/auth/login" className="w-full">
                <Button variant="outline" className="w-full" size="lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Features Preview */}
          <div className="mt-12 space-y-6">
            <h3 className="text-lg font-medium text-foreground">Key Features</h3>
            <div className="grid gap-4 text-sm">
              <div className="flex items-center space-x-3 p-3 bg-sage-light/30 rounded-lg">
                <div className="w-3 h-3 bg-primary rounded-full" />
                <span className="text-muted-foreground">Visual decay tracking</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-terracotta-light/30 rounded-lg">
                <div className="w-3 h-3 bg-accent rounded-full" />
                <span className="text-muted-foreground">Intelligent practice reminders</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-amber-light/30 rounded-lg">
                <div className="w-3 h-3 bg-warning rounded-full" />
                <span className="text-muted-foreground">AI-generated practice questions</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-sage-light/30 rounded-lg">
                <div className="w-3 h-3 bg-success rounded-full" />
                <span className="text-muted-foreground">Skill folder organization</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
