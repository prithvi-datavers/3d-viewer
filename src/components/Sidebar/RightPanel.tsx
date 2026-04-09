import { Trash2, Ruler, Eye, EyeOff } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { selectMesh } from '../../lib/babylon/SelectionManager'
import type { SidebarPanel } from './LeftSidebar'

interface Props {
  activePanel: SidebarPanel | null
}

export default function RightPanel({ activePanel }: Props) {
  const isOpen = activePanel !== null

  return (
    <div className={`right-panel${isOpen ? ' open' : ''}`}>
      <div className="right-panel-inner">
        {activePanel === 'measure' && <MeasurePanel />}
        {activePanel === 'tree'    && <TreePanel />}
      </div>
    </div>
  )
}

/* ── Measure Panel ─────────────────────────────────── */
function MeasurePanel() {
  const measureMode       = useViewerStore((s) => s.measureMode)
  const toggleMeasureMode = useViewerStore((s) => s.toggleMeasureMode)
  const measurements      = useViewerStore((s) => s.measurements)
  const removeMeasurement = useViewerStore((s) => s.removeMeasurement)
  const clearMeasurements = useViewerStore((s) => s.clearMeasurements)

  const handleRemove = (id: string) => {
    const m = measurements.find((m) => m.id === id)
    if (m) m.meshes.forEach((mesh) => { try { mesh.dispose() } catch (_) {} })
    removeMeasurement(id)
  }

  const handleClearAll = () => {
    measurements.forEach((m) => m.meshes.forEach((mesh) => { try { mesh.dispose() } catch (_) {} }))
    clearMeasurements()
  }

  return (
    <>
      <div className="panel-header">
        <span className="panel-header-title">Measure</span>
      </div>
      <div className="panel-body">
        <button
          className={`measure-mode-toggle${measureMode ? ' active' : ''}`}
          onClick={toggleMeasureMode}
        >
          <Ruler size={14} strokeWidth={1.75} />
          {measureMode ? 'Click two points…' : 'Start Measuring'}
        </button>

        {measurements.length > 0 && (
          <div className="panel-section">
            <div className="panel-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Results</span>
              <button className="measure-clear-btn" onClick={handleClearAll}>Clear all</button>
            </div>
            {measurements.map((m) => (
              <div key={m.id} className="measure-item">
                <div>
                  <div className="measure-item-type">{m.type}</div>
                  <div className="measure-value">{m.display}</div>
                </div>
                <button className="measure-delete" onClick={() => handleRemove(m.id)} title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {measurements.length === 0 && !measureMode && (
          <p className="panel-empty-msg">Click "Start Measuring" then click two points in the viewport.</p>
        )}
      </div>
    </>
  )
}

/* ── Tree Panel ────────────────────────────────────── */
function TreePanel() {
  const modelParts        = useViewerStore((s) => s.modelParts)
  const setPartVisibility = useViewerStore((s) => s.setPartVisibility)
  const babylonScene      = useViewerStore((s) => s.babylonScene)
  const selectedMeshName  = useViewerStore((s) => s.selectedMeshName)
  const setSelection      = useViewerStore((s) => s.setSelection)

  const handleSelect = (name: string) => {
    if (!babylonScene) return
    const mesh = babylonScene.getMeshByName(name)
    if (!mesh) return
    const selInfo = selectMesh(mesh)
    setSelection(name, selInfo)
  }

  const toggleVisibility = (name: string, currentVisible: boolean) => {
    const mesh = babylonScene?.getMeshByName(name)
    if (mesh) mesh.setEnabled(!currentVisible)
    setPartVisibility(name, !currentVisible)
  }

  return (
    <>
      <div className="panel-header">
        <span className="panel-header-title">Model Tree</span>
      </div>
      <div className="panel-body">
        {modelParts.length === 0 ? (
          <p className="panel-empty-msg">No model loaded.</p>
        ) : (
          <div className="tree-list">
            {modelParts.map((part) => (
              <div
                key={part.name}
                className={`tree-item${selectedMeshName === part.name ? ' selected' : ''}${!part.visible ? ' hidden' : ''}`}
                onClick={() => handleSelect(part.name)}
              >
                <span className="tree-item-dot" style={{ background: part.color }} />
                <span className="tree-item-name">{part.displayName}</span>
                <button
                  className="tree-item-eye"
                  onClick={(e) => { e.stopPropagation(); toggleVisibility(part.name, part.visible) }}
                  title={part.visible ? 'Hide' : 'Show'}
                >
                  {part.visible
                    ? <Eye size={13} strokeWidth={1.5} />
                    : <EyeOff size={13} strokeWidth={1.5} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
