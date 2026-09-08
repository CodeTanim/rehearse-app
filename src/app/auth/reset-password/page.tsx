import Link from "next/link"
import { AuthLayout } from "@/components/auth/auth-layout"
import { buttonClassName } from "@/components/ui/button"

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Password recovery isn’t available yet">
      <div className="space-y-5 text-sm text-muted-foreground">
        <p className="rounded-lg border border-border bg-muted/40 p-3 leading-6">
          No reset email will be sent.
        </p>
        <Link href="/auth/login" className={buttonClassName({ variant: "outline", className: "w-full" })}>
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
