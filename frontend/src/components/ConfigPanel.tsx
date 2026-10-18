import type { ImageConfigInfo } from '../types'
import { formatDate } from '../format'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="kv-row">
      <div className="kv-key">{label}</div>
      <div className="kv-value">{children}</div>
    </div>
  )
}

export default function ConfigPanel({ config }: { config: ImageConfigInfo }) {
  return (
    <div className="kv">
      <Row label="Created">{config.created ? formatDate(config.created) : '—'}</Row>
      <Row label="OS / Arch">
        {[config.os, config.architecture, config.variant].filter(Boolean).join(' / ') || '—'}
      </Row>
      {config.user && <Row label="User">{config.user}</Row>}
      {config.workdir && <Row label="Working dir">{config.workdir}</Row>}
      {config.stopSignal && <Row label="Stop signal">{config.stopSignal}</Row>}
      {config.entrypoint && config.entrypoint.length > 0 && (
        <Row label="Entrypoint">
          <code className="mono">{config.entrypoint.join(' ')}</code>
        </Row>
      )}
      {config.cmd && config.cmd.length > 0 && (
        <Row label="Cmd">
          <code className="mono">{config.cmd.join(' ')}</code>
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
          <ul className="mono list-env">
            {config.env.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Row>
      )}
      {config.labels && Object.keys(config.labels).length > 0 && (
        <Row label="Labels">
          <div className="labels">
            {Object.entries(config.labels).map(([k, v]) => (
              <div key={k} className="label-row">
                <span className="mono label-key">{k}</span>
                <span className="mono label-value">{v}</span>
              </div>
            ))}
          </div>
        </Row>
      )}
    </div>
  )
}
