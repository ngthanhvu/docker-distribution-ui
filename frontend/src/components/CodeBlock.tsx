import CopyButton from './CopyButton'

export default function CodeBlock({ lines }: { lines: string[] }) {
  const text = lines.join('\n')
  return (
    <div className="code">
      <div className="code-head">
        <span className="code-lang">shell</span>
        <CopyButton text={text} className="code-copy" />
      </div>
      <pre className="mono">
        {lines.map((line, i) => (
          <div key={i} className={line.startsWith('#') ? 'code-comment' : undefined}>
            {line || '\u00A0'}
          </div>
        ))}
      </pre>
    </div>
  )
}
