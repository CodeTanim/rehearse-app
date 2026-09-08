import { forwardRef, type InputHTMLAttributes, useId } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      error,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const errorId = error ? `${props.id ?? generatedId}-error` : undefined
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined

    return (
      <div className="space-y-1.5">
        <input
          ref={ref}
          type={type}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={cn(
            "paper-input flex px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm",
            error && "border-destructive focus-visible:ring-destructive",
            className,
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="error-text text-xs">
            {error}
          </p>
        )}
      </div>
    )
  },
)
Input.displayName = "Input"

export { Input }
