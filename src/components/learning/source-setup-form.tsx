"use client"

import { useActionState, useState } from "react"

import { addSourceAction } from "@/app/actions/topic-source"
import { SubmitButton } from "@/components/app/submit-button"
import { Alert } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type SourceType = "URL" | "TEXT" | "NOTE" | "PDF"
const MAX_PDF_UPLOAD_BYTES = 6 * 1024 * 1024

export function SourceSetupForm({
  goalSkillId,
  secondary = false,
}: {
  goalSkillId: string
  secondary?: boolean
}) {
  const [state, action] = useActionState(addSourceAction, {})
  const [sourceType, setSourceType] = useState<SourceType>("URL")
  const [fileError, setFileError] = useState<string | null>(null)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="goalSkillId" value={goalSkillId} />

      {state.error || fileError ? (
        <Alert role="alert" variant="destructive" className="text-sm">
          {fileError ?? state.error}
        </Alert>
      ) : null}

      <div>
        <label htmlFor="source-type" className="mb-1.5 block text-sm font-medium">
          Source
        </label>
        <select
          id="source-type"
          name="sourceType"
          value={sourceType}
          onChange={(event) => {
            setSourceType(event.target.value as SourceType)
            setFileError(null)
          }}
          className="paper-input flex min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="URL">Website</option>
          <option value="TEXT">Paste text</option>
          <option value="NOTE">Write note</option>
          <option value="PDF">PDF</option>
        </select>
      </div>

      {sourceType === "TEXT" || sourceType === "NOTE" ? (
        <>
          <div>
            <label htmlFor="source-name" className="mb-1.5 block text-sm font-medium">
              Name {sourceType === "TEXT" ? (
                <span className="font-normal text-muted-foreground">(optional)</span>
              ) : null}
            </label>
            <Input
              id="source-name"
              name="displayName"
              maxLength={200}
              autoComplete="off"
              placeholder={sourceType === "NOTE" ? "Note title" : "My notes"}
              required={sourceType === "NOTE"}
            />
          </div>
          <div>
            <label htmlFor="source-text" className="mb-1.5 block text-sm font-medium">
              {sourceType === "NOTE" ? "Note" : "Text"}
            </label>
            <Textarea
              id="source-text"
              name="text"
              maxLength={500_000}
              rows={10}
              autoFocus
              placeholder={sourceType === "NOTE" ? "Write what you know" : "Paste notes or an excerpt"}
              required
            />
          </div>
        </>
      ) : sourceType === "URL" ? (
        <div>
          <label htmlFor="source-url" className="mb-1.5 block text-sm font-medium">
            Website URL
          </label>
          <Input
            id="source-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            maxLength={2_048}
            autoFocus
            placeholder="https://example.com/guide"
            required
          />
        </div>
      ) : (
        <div>
          <label htmlFor="source-file" className="mb-1.5 block text-sm font-medium">
            PDF
          </label>
          <Input
            id="source-file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              const file = event.target.files?.[0]
              setFileError(
                file && file.size > MAX_PDF_UPLOAD_BYTES
                  ? "PDFs must be 6 MB or smaller."
                  : null,
              )
            }}
            required
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Short, text-based PDFs up to 6 MB. Split long documents first.
          </p>
        </div>
      )}

      <SubmitButton
        className="w-full sm:w-auto"
        size="lg"
        variant={secondary ? "outline" : "default"}
        pendingLabel="Adding…"
        disabled={fileError !== null}
      >
        Add source
      </SubmitButton>
    </form>
  )
}
