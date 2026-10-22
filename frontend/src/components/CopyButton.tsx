import { useState } from 'react'

export default function CopyButton({
  text,
  title = 'Copy',
  className,
}: {
  text: string
  title?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      className={`inline-flex cursor-pointer shrink-0 select-none items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors duration-150 ${
        copied
          ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 active:bg-sky-500/20'
      } ${className ?? ''}`}
      onClick={copy}
      title={copied ? 'Copied!' : title}
      aria-label={title}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

