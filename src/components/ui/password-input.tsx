"use client"

import { forwardRef, useId, useState } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Input, InputProps } from "./input"
import { Button } from "./button"
import { cn } from "@/lib/utils"

interface PasswordInputProps extends Omit<InputProps, "type"> {
  showRequirements?: boolean
  minimumLength?: number
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      showRequirements = false,
      minimumLength = 8,
      value,
      className,
      "aria-describedby": ariaDescribedBy,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false)
    const requirementsId = useId()

    const password = typeof value === "string" ? value : ""
    const maximumLength = props.maxLength
    const meetsLengthRequirement =
      password.length >= minimumLength &&
      (typeof maximumLength !== "number" || password.length <= maximumLength)
    const lengthRequirement =
      typeof maximumLength === "number"
        ? `${minimumLength}–${maximumLength} characters`
        : `At least ${minimumLength} characters`
    const describedBy = [
      ariaDescribedBy,
      showRequirements ? requirementsId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            {...props}
            ref={ref}
            type={showPassword ? "text" : "password"}
            value={value}
            aria-describedby={describedBy}
            className={cn("pr-12", className)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-11 w-11 rounded-l-none hover:bg-secondary"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls={props.id}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? (
              <EyeOffIcon aria-hidden="true" className="size-4" />
            ) : (
              <EyeIcon aria-hidden="true" className="size-4" />
            )}
          </Button>
        </div>

        {showRequirements && (
          <p
            id={requirementsId}
            className={cn("flex items-center gap-2 text-sm text-muted-foreground", meetsLengthRequirement && "text-success")}
          >
            <span aria-hidden="true">{meetsLengthRequirement ? "✓" : "○"}</span>
            <span className="sr-only">
              {meetsLengthRequirement ? "Requirement met: " : "Password requirement: "}
            </span>
            <span>{lengthRequirement}</span>
          </p>
        )}
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
