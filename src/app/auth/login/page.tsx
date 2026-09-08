import { LoginForm } from "./login-form"
import { sanitizeReturnTo } from "@/lib/auth/return-to"

type LoginPageProps = {
  searchParams: Promise<{
    registered?: string | string[]
    returnTo?: string | string[]
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const registered = params.registered === "1"
  const returnTo = sanitizeReturnTo(params.returnTo)

  return <LoginForm registered={registered} returnTo={returnTo} />
}
