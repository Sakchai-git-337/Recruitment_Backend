"use client"

// Uploaded documents appended after the paper form when printing: images as-is, PDFs rasterised page by page.
import { fetchBlob } from "@/lib/api"
import { DOC_TYPES, DOC_TYPE_LABEL, type ApplicationDocument } from "@/lib/types"

export type AttachmentPage = { src: string; label: string }

const ORDER = DOC_TYPES.map((d) => d.type)

async function pdfPages(blob: Blob): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  const out: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2 }) // ~144 dpi on A4, sharp enough for print
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    const png = await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("render failed"))), "image/png"))
    out.push(URL.createObjectURL(png))
  }
  await doc.destroy()
  return out
}

/** fetch every document (DOC_TYPES order) and turn it into one image per printed page */
export async function loadAttachments(docs: ApplicationDocument[]): Promise<AttachmentPage[]> {
  const sorted = [...docs].sort((a, b) => ORDER.indexOf(a.doc_type) - ORDER.indexOf(b.doc_type))
  const pages: AttachmentPage[] = []
  for (const d of sorted) {
    const blob = await fetchBlob(`/documents/${d.document_id}`)
    const label = `${DOC_TYPE_LABEL[d.doc_type] ?? d.doc_type} — ${d.filename}`
    if (blob.type === "application/pdf" || d.content_type === "application/pdf") {
      const srcs = await pdfPages(blob)
      srcs.forEach((src, i) => pages.push({ src, label: srcs.length > 1 ? `${label} (หน้า ${i + 1}/${srcs.length})` : label }))
    } else {
      pages.push({ src: URL.createObjectURL(blob), label })
    }
  }
  return pages
}

export function PrintAttachments({ pages }: { pages: AttachmentPage[] }) {
  return (
    <div className="sab">
      {pages.map((p) => (
        <section key={p.src} className="sab-page sab-attach">
          <p className="sab-attach-label">เอกสารแนบ: {p.label}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt={p.label} />
        </section>
      ))}
    </div>
  )
}
