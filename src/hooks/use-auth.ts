"use client"

import { useSession, signIn, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setIsLoading(false)
        return { error: "Invalid email or password" }
      }

      router.push("/dashboard")
      return { success: true }
    } catch {
      setIsLoading(false)
      return { error: "An error occurred during login" }
    }
  }

  const logout = async () => {
    setIsLoading(true)
    await signOut({ redirect: false })
    router.push("/")
    setIsLoading(false)
  }

  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === "loading" || isLoading,
    login,
    logout,
  }
}