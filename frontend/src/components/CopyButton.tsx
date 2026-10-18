import { useState } from 'react'
import { CheckIcon, CopyIcon } from './icons'

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
      className={`btn-icon ${copied ? 'copied' : ''} ${className ?? ''}`}
      onClick={copy}
      title={copied ? 'Copied!' : title}
      aria-label={title}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}
