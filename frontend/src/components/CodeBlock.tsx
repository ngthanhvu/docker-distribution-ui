import CopyButton from './CopyButton'

export default function CodeBlock({ lines }: { lines: string[] }) {
  const text = lines.join('\n')
  return (
    <div className="border border-zinc-800 bg-black">
      <div className="flex items-center justify-between border-b border-zinc-900 py-1 pl-3.5 pr-1.5">
        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">shell</span>
        <CopyButton text={text} title="Copy command" />
      </div>
      <pre className="m-0 overflow-x-auto px-3.5 py-3 text-[12.5px] leading-relaxed">
        {lines.map((line, i) => {
          if (line.startsWith('#')) {
            return (
              <div key={i} className="text-zinc-600">
                {line}
              </div>
            )
          }
          if (!line) return <div key={i}>{'\u00A0'}</div>
          return (
            <div key={i}>
              <span className="select-none text-zinc-600">$ </span>
              <span className="text-zinc-300">{line}</span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
