import { SECTIONS, STEP_COUNT } from "./application-form.ts"
import { DOC_TYPES } from "./types.ts"

export type ErrorTarget = { step: number; field?: string }

/** map a server error message to the wizard step (and field) it is about; null = unknown */
export function stepForError(message: string): ErrorTarget | null {
  if (message.includes("ไฟล์") || message.includes("เอกสาร") || DOC_TYPES.some((d) => message.includes(d.label))) {
    const doc = DOC_TYPES.find((d) => message.includes(d.label) || message.includes(d.type))
    return { step: STEP_COUNT, field: doc ? "doc_" + doc.type : undefined }
  }
  let best: { len: number; target: ErrorTarget } | null = null
  SECTIONS.forEach((s, i) => {
    for (const f of s.fields) {
      for (const needle of [f.key, f.label]) {
        if (needle.length > (best?.len ?? 0) && message.includes(needle)) best = { len: needle.length, target: { step: i + 1, field: f.key } }
      }
    }
  })
  return (best as { target: ErrorTarget } | null)?.target ?? null
}
