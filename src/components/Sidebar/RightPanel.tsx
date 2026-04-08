import { Trash2, Ruler } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView } from '../../lib/babylon/CameraManager'
import { ViewCubeIcon } from '../Toolbar/ViewIcons'
import type { SidebarPanel } from './LeftSidebar'
import type { ViewPreset, ShadingMode } from '../../types/viewer'

const SHADING_OPTIONS: { mode: ShadingMode; label: string }[] = [
  { mode: 'shaded',      label: 'Solid'        },
  { mode: 'wireframe',   label: 'Wireframe'    },
  { mode: 'shadedEdges', label: 'Solid + Edges' },
]

const VIEW_PRESETS: { id: ViewPreset; face: Parameters<typeof ViewCubeIcon>[0]['face']; label: string }[] = [
  { id: 'FRONT',  face: 'front',  label: 'Front'  },
  { id: 'BACK',   face: 'back',   label: 'Back'   },
  { id: 'RIGHT',  face: 'right',  label: 'Right'  },
  { id: 'LEFT',   face: 'left',   label: 'Left'   },
  { id: 'TOP',    face: 'top',    label: 'Top'    },
  { id: 'BOTTOM', face: 'bottom', label: 'Bottom' },
  { id: 'ISO',    face: 'iso',    label: 'ISO'    },
]

interface Props {
  activePanel: SidebarPanel | null
}

export default function RightPanel({ activePanel }: Props) {
  const isOpen = activePanel !== null

  return (
    <div className={`right-panel${isOpen ? ' open' : ''}`}>
      <div className="right-panel-inner">
        {activePanel === 'select'  && <SelectPanel />}
        {activePanel === 'display' && <DisplayPanel />}
        {activePanel === 'view'    && <ViewPanel />}
        {activePanel === 'measure' && <MeasurePanel />}
        {activePanel === 'tree'    && <TreePanel />}
      </div>
    </div>
  )
}

/* ── Select Panel ──────────────────────────────────── */
function SelectPanel() {
  const selectionInfo    = useViewerStore((s) => s.selectionInfo)
  const selectedMeshName = useViewerStore((s) => s.selectedMeshName)

  return (
    <>
      <div className="panel-header">
        <span className="panel-header-title">Selection</span>
      </div>
      <div className="panel-body">
        {selectionInfo ? (
          <div className="panel-section">
            <div className="prop-row">
              <span className="prop-label">Name</span>
              <span className="prop-value" style={{ fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
          </div>
        ) : (
          <p className="panel-empty-msg">Click a mesh in the viewport to inspect its properties.</p>
        )}
      </div>
    </>
  )
}

/* ── Display Panel ─────────────────────────────────── */
function DisplayPanel() {
  const shadingMode    = useViewerStore((s) => s.shadingMode)
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const gridVisible    = useViewerStore((s) => s.gridVisible)
  const toggleGrid     = useViewerStore((s) => s.toggleGrid)

  return (
    <>
      <div className="panel-header">
        <span className="panel-header-title">Display</span>
      </div>
      <div className="panel-body">
        <div className="panel-section">
          <div className="panel-section-label">Shading Mode</div>
          <div className="display-btn-group">
            {SHADING_OPTIONS.map(({ mode, label }) => (
              <button
                key={mode}
                className={`display-btn${shadingMode === mode ? ' active' : ''}`}
                onClick={() => setShadingMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="panel-section">
          <div className="panel-section-label">Scene</div>
          <button
            className={`display-btn${gridVisible ? ' active' : ''}`}
            onClick={toggleGrid}
          >
            {gridVisible ? 'Hide Grid' : 'Show Grid'}
          </button>
        </div>
      </div>
    </>
  )
}

/* ── View Panel ────────────────────────────────────── */
function ViewPanel() {
  return (
    <>
      <div className="panel-header">
        <span className="panel-header-title">View Presets</span>
      </div>
      <div className="panel-body">
        <div className="view-preset-grid">
          {VIEW_PRESETS.map(({ id, face, label }) => (
            <button
              key={id}
              className="view-preset-btn"
              onClick={() => animateToView(id)}
            >
              <ViewCubeIcon face={face} size={22} />
              <span className="view-preset-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
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

/* ── Tree Panel (future) ───────────────────────────── */
function TreePanel() {
  return (
    <>
      <div className="panel-header">
        <span className="panel-header-title">Model Tree</span>
      </div>
      <div className="panel-body">
        <p className="panel-empty-msg">Assembly tree will appear here when a multi-part STEP file is loaded.</p>
      </div>
    </>
  )
}
