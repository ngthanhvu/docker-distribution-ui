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
      className={`inline-flex cursor-pointer shrink-0 items-center px-1.5 py-0.5 text-[11px] uppercase tracking-[0.08em] transition-colors ${
        copied ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-100'
      } ${className ?? ''}`}
      onClick={copy}
      title={copied ? 'Copied!' : title}
      aria-label={title}
    >
      {copied ? '[ OK ]' : '[ COPY ]'}
    </button>
  )
}
