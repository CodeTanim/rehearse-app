import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { ZodError } from "zod"
import { registerSchema } from "@/lib/auth/validation"
import {
  AUTH_RATE_LIMITS,
  consumeRateLimit,
  getClientIdentifier,
} from "@/lib/auth/rate-limit"

export async function POST(request: NextRequest) {
  const registrationLimit = consumeRateLimit({
    scope: "registration-client",
    identifier: getClientIdentifier(request.headers),
    policy: AUTH_RATE_LIMITS.registrationByClient,
  })

  if (!registrationLimit.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(registrationLimit.retryAfterSeconds) },
      },
    )
  }

  try {
    const body = await request.json()
    const { name, email, password, timezone = "UTC" } = registerSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        timezone,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      }
    })

    return NextResponse.json(
      { message: "User created successfully", user },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
