import type { ImageConfigInfo } from '../types'
import { formatDate } from '../format'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-zinc-900 py-2.5 last:border-b-0">
      <div className="pt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="min-w-0 break-words text-[12.5px] text-zinc-300">{children}</div>
    </div>
  )
}

export default function ConfigPanel({ config }: { config: ImageConfigInfo }) {
  return (
    <div className="grid">
      <Row label="Created">{config.created ? formatDate(config.created) : '—'}</Row>
      <Row label="OS / Arch">
        {[config.os, config.architecture, config.variant].filter(Boolean).join(' / ') || '—'}
      </Row>
      {config.user && <Row label="User">{config.user}</Row>}
      {config.workdir && <Row label="Working dir">{config.workdir}</Row>}
      {config.stopSignal && <Row label="Stop signal">{config.stopSignal}</Row>}
      {config.entrypoint && config.entrypoint.length > 0 && (
        <Row label="Entrypoint">
          <code className="border border-zinc-800 bg-black px-1.5 py-px text-[11.5px]">
            {config.entrypoint.join(' ')}
          </code>
        </Row>
      )}
      {config.cmd && config.cmd.length > 0 && (
        <Row label="Cmd">
          <code className="border border-zinc-800 bg-black px-1.5 py-px text-[11.5px]">
            {config.cmd.join(' ')}
          </code>
        </Row>
      )}
      {config.exposedPorts && config.exposedPorts.length > 0 && (
        <Row label="Exposed ports">{config.exposedPorts.join(', ')}</Row>
      )}
      {config.volumes && config.volumes.length > 0 && (
        <Row label="Volumes">{config.volumes.join(', ')}</Row>
      )}
      {config.env && config.env.length > 0 && (
        <Row label="Env">
          <ul className="m-0 list-none p-0 text-[11.5px] text-zinc-400">
            {config.env.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Row>
      )}
      {config.labels && Object.keys(config.labels).length > 0 && (
        <Row label="Labels">
          <div className="flex flex-col gap-1.5">
            {Object.entries(config.labels).map(([k, v]) => (
              <div key={k} className="flex flex-wrap gap-2.5 text-[11.5px]">
                <span className="text-zinc-300">{k}</span>
                <span className="min-w-0 break-all text-zinc-600">{v}</span>
              </div>
            ))}
          </div>
        </Row>
      )}
    </div>
  )
}
