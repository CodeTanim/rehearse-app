import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import {
  AUTH_RATE_LIMITS,
  consumeRateLimit,
  getClientIdentifier,
  resetRateLimit,
} from "@/lib/auth/rate-limit"

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
})

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        const clientIdentifier = getClientIdentifier(request.headers)
        const clientLimit = consumeRateLimit({
          scope: "login-client",
          identifier: clientIdentifier,
          policy: AUTH_RATE_LIMITS.loginByClient,
        })
        if (!clientLimit.allowed) return null

        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const principalLimit = consumeRateLimit({
          scope: "login-principal",
          identifier: parsed.data.email,
          policy: AUTH_RATE_LIMITS.loginByPrincipal,
        })
        if (!principalLimit.allowed) return null

        const user = await prisma.user.findUnique({
          where: {
            email: parsed.data.email
          }
        })

        if (!user || !user.password) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          parsed.data.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        // The principal bucket tracks consecutive failures, not ordinary
        // successful sign-ins by the account owner.
        resetRateLimit({
          scope: "login-principal",
          identifier: parsed.data.email,
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  session: {
    strategy: "jwt" as const
  },
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id as string
      }
      return session
    }
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions)
