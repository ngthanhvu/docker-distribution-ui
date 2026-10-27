import { useState } from 'react'
import TermButton from './TermButton'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  confirmText,
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  busyLabel?: string
  /** When set, the user must type this exact text to enable the confirm button. */
  confirmText?: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const ready = !confirmText || typed === confirmText

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <h3 className="m-0 mb-2.5 text-base font-bold text-white">{title}</h3>
        <p className="m-0 mb-5 wrap-break-word text-[12.5px] leading-relaxed text-zinc-500">
          {message}
        </p>
        {confirmText && (
          <label className="mb-6 block">
            <span className="block text-[11px] uppercase tracking-[0.12em] text-zinc-500">
              Type <span className="text-zinc-300">{confirmText}</span> to confirm
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder={confirmText}
              className="mt-1.5 w-full border border-zinc-800 bg-black px-3 py-2 text-[13px] text-zinc-200 outline-none transition-colors focus:border-zinc-400 placeholder:text-zinc-600"
            />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <TermButton variant="neutral" onClick={onClose} disabled={busy}>
            Cancel
          </TermButton>
          <TermButton danger onClick={onConfirm} disabled={busy || !ready}>
            {busy ? busyLabel : confirmLabel}
          </TermButton>
        </div>
      </div>
    </div>
  )
}
