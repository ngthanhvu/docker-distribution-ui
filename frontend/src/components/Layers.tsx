import type { Layer } from '../types'
import { formatDate, formatSize, shortDigest, timeAgo } from '../format'

export default function Layers({ layers }: { layers: Layer[] }) {
  if (layers.length === 0) {
    return <p className="muted">No layer information available.</p>
  }
  return (
    <ol className="layers">
      {layers.map((layer, i) => {
        const label =
          layer.command ||
          (layer.digest ? `layer ${shortDigest(layer.digest)}` : 'image metadata')
        return (
          <li key={i} className={`layer ${layer.empty ? 'layer-empty' : ''}`}>
            <div className="layer-index">{layers.length - i}</div>
            <div className="layer-body">
              <div className="layer-command mono">{label}</div>
              <div className="layer-meta">
                {layer.comment && <span className="layer-comment">{layer.comment}</span>}
                {layer.digest && (
                  <span className="mono layer-digest" title={layer.digest}>
                    {shortDigest(layer.digest)}
                  </span>
                )}
                {layer.created && (
                  <span title={formatDate(layer.created)}>{timeAgo(layer.created)}</span>
                )}
                <span className="layer-size">
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
