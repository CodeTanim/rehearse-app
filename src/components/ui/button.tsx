import { forwardRef, type ButtonHTMLAttributes } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "paper-button select-none whitespace-nowrap text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 aria-disabled:pointer-events-none aria-disabled:opacity-60",
  {
    variants: {
      variant: {
        default: "paper-button--primary",
        accent: "paper-button--accent",
        destructive: "paper-button--destructive",
        outline: "paper-button--outline",
        secondary: "paper-button--secondary",
        ghost: "paper-button--ghost",
        link: "paper-button--link",
      },
      size: {
        default: "min-h-11 px-3.5 py-2",
        sm: "min-h-10 px-3 py-1.5 text-sm",
        lg: "min-h-11 px-5 py-2.5 text-sm",
        icon: "size-11 shrink-0 p-0",
        "icon-sm": "size-10 min-h-10 shrink-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

export function buttonClassName({
  variant = "default",
  size = "default",
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(buttonVariants({ variant, size }), className)
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      isLoading = false,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const unavailable = disabled || isLoading

    return (
      <button
        ref={ref}
        className={buttonVariants({ variant, size, className })}
        disabled={unavailable}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <LoaderCircleIcon
            aria-hidden="true"
            className="size-4 animate-spin"
          />
        )}
        {isLoading && <span className="sr-only">Loading. </span>}
        {children}
      </button>
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
