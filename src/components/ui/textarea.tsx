import { forwardRef, type TextareaHTMLAttributes, useId } from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
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
        <textarea
          ref={ref}
          aria-describedby={describedBy}
          aria-invalid={error ? true : ariaInvalid}
          className={cn(
            "paper-input min-h-24 resize-y px-3 py-2.5 text-base leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:text-sm",
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
Textarea.displayName = "Textarea"

export { Textarea }
