import { Trash2 } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'

export default function PropertiesPanel() {
  const selectionInfo = useViewerStore((s) => s.selectionInfo)
  const selectedMeshName = useViewerStore((s) => s.selectedMeshName)
  const measurements = useViewerStore((s) => s.measurements)
  const removeMeasurement = useViewerStore((s) => s.removeMeasurement)
  const clearMeasurements = useViewerStore((s) => s.clearMeasurements)
  const babylonScene = useViewerStore((s) => s.babylonScene)

  const handleRemove = (id: string) => {
    // Dispose 3D meshes
    const m = measurements.find((m) => m.id === id)
    if (m) m.meshes.forEach((mesh) => { try { mesh.dispose() } catch (_) {} })
    removeMeasurement(id)
  }

  const handleClearAll = () => {
    measurements.forEach((m) => m.meshes.forEach((mesh) => { try { mesh.dispose() } catch (_) {} }))
    clearMeasurements()
  }

  return (
    <div className="properties-panel">
      {/* Selection info */}
      <div className="panel-section">
        <div className="panel-section-title">Selection</div>
        {selectionInfo ? (
          <>
            <div className="prop-row">
              <span className="prop-label">Name</span>
              <span className="prop-value" style={{ fontSize: 10, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedMeshName}
              </span>
            </div>
            <div className="prop-row">
              <span className="prop-label">Width (X)</span>
              <span className="prop-value">{selectionInfo.width}</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">Depth (Y)</span>
              <span className="prop-value">{selectionInfo.depth}</span>
            </div>
            <div className="prop-row">
              <span className="prop-label">Height (Z)</span>
              <span className="prop-value">{selectionInfo.height}</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
            Click a mesh to inspect
          </div>
        )}
      </div>

      {/* Measurements */}
      <div className="panel-section" style={{ flex: 1 }}>
        <div className="panel-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Measurements</span>
          {measurements.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10, padding: '0 2px' }}
              title="Clear all"
            >
              Clear all
            </button>
          )}
        </div>

        {measurements.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6 }}>
            Use the Ruler tool to measure distances
          </div>
        ) : (
          <div>
            {measurements.map((m) => (
              <div key={m.id} className="measure-item">
                <div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.5 }}>
                    {m.type}
                  </div>
                  <div className="measure-value">{m.display}</div>
                </div>
                <button className="measure-delete" onClick={() => handleRemove(m.id)} title="Delete">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shortcuts help */}
      <div className="panel-section" style={{ opacity: 0.5 }}>
        <div className="panel-section-title">Shortcuts</div>
        {[
          ['W', 'Wireframe'],
          ['G', 'Toggle Grid'],
          ['F', 'Fit to Scene'],
          ['P', 'Persp / Ortho'],
          ['M', 'Measure Tool'],
          ['Esc', 'Cancel / Deselect'],
        ].map(([key, desc]) => (
          <div key={key} className="prop-row">
            <code style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 3 }}>
              {key}
            </code>
            <span className="prop-label">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
