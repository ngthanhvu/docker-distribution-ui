import type { Layer } from '../types'
import { formatDate, formatSize, shortDigest, timeAgo } from '../format'

export default function Layers({ layers }: { layers: Layer[] }) {
  if (layers.length === 0) {
    return <p className="m-0 text-[12.5px] text-zinc-600">No layer information available.</p>
  }
  return (
    <ol className="m-0 list-none p-0">
      {layers.map((layer, i) => {
        const label =
          layer.command ||
          (layer.digest ? `layer ${shortDigest(layer.digest)}` : 'image metadata')
        return (
          <li
            key={i}
            className="flex gap-3 border-b border-zinc-900 py-2.5 last:border-b-0"
          >
            <div className="w-7 shrink-0 pt-0.5 text-right text-[11px] text-zinc-600">
              {layers.length - i}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`break-words text-[12.5px] leading-relaxed ${
                  layer.empty ? 'text-zinc-600' : 'text-zinc-300'
                }`}
              >
                {label}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-0.5 text-[11px] text-zinc-600">
                {layer.comment && <span>{layer.comment}</span>}
                {layer.digest && (
                  <span title={layer.digest}>{shortDigest(layer.digest)}</span>
                )}
                {layer.created && (
                  <span title={formatDate(layer.created)}>{timeAgo(layer.created)}</span>
                )}
                <span className="ml-auto text-zinc-400">
                  {layer.empty ? '0 B' : formatSize(layer.size)}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
