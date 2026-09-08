import Link, { type LinkProps } from "next/link"
import type { AnchorHTMLAttributes } from "react"
import { buttonClassName, type ButtonSize, type ButtonVariant } from "./button"
import { cn } from "@/lib/utils"

export interface ButtonLinkProps
  extends LinkProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonLinkProps) {
  return <Link className={cn(buttonClassName({ variant, size }), className)} {...props} />
}
