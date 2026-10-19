import TermButton from './TermButton'

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  busy,
  onConfirm,
  onClose,
}: {
  title: string
  message: string
  confirmLabel?: string
  busyLabel?: string
  busy: boolean
  onConfirm: () => void
  onClose: () => void
}) {
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
        <p className="m-0 mb-6 break-words text-[12.5px] leading-relaxed text-zinc-500">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <TermButton onClick={onClose} disabled={busy}>
            Cancel
          </TermButton>
          <TermButton danger onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </TermButton>
        </div>
      </div>
    </div>
  )
}
