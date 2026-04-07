import {
  Box, Circle, Grid3X3, Ruler, Eye, Layers,
  Move, RotateCcw, ZoomIn,
} from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import type { ShadingMode, ViewPreset } from '../../types/viewer'
import { animateToView } from '../../lib/babylon/CameraManager'
import { fitToScene } from '../../lib/babylon/CameraManager'

const SHADING_MODES: { mode: ShadingMode; label: string; title: string }[] = [
  { mode: 'shaded',      label: 'S',  title: 'Solid / Shaded' },
  { mode: 'wireframe',   label: 'W',  title: 'Wireframe' },
  { mode: 'shadedEdges', label: 'SE', title: 'Solid + Edges' },
]

const VIEW_PRESETS: { id: ViewPreset; label: string }[] = [
  { id: 'FRONT',  label: 'F' },
  { id: 'BACK',   label: 'Bk' },
  { id: 'RIGHT',  label: 'R' },
  { id: 'LEFT',   label: 'L' },
  { id: 'TOP',    label: 'T' },
  { id: 'BOTTOM', label: 'Bo' },
  { id: 'ISO',    label: '⧦' },
]

export default function Toolbar() {
  const shadingMode = useViewerStore((s) => s.shadingMode)
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const cameraMode = useViewerStore((s) => s.cameraMode)
  const setCameraMode = useViewerStore((s) => s.setCameraMode)
  const gridVisible = useViewerStore((s) => s.gridVisible)
  const toggleGrid = useViewerStore((s) => s.toggleGrid)
  const measureMode = useViewerStore((s) => s.measureMode)
  const toggleMeasureMode = useViewerStore((s) => s.toggleMeasureMode)
  const babylonScene = useViewerStore((s) => s.babylonScene)
  const cameraRef = useViewerStore((s) => s.cameraRef)

  const handleFit = () => {
    if (babylonScene && cameraRef) {
      fitToScene(cameraRef, babylonScene.meshes.slice())
    }
  }

  const toggleCamMode = () => {
    setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
  }

  return (
    <div className="toolbar">
      {/* Display modes */}
      <span className="toolbar-group-label">VIEW</span>
      {SHADING_MODES.map(({ mode, label, title }) => (
        <button
          key={mode}
          className={`tool-btn${shadingMode === mode ? ' active' : ''}`}
          title={title}
          onClick={() => setShadingMode(mode)}
        >
          <span className="tool-btn-text">{label}</span>
        </button>
      ))}

      <div className="toolbar-sep-h" />

      {/* Camera */}
      <span className="toolbar-group-label">CAM</span>
      <button
        className={`tool-btn${cameraMode === 'orthographic' ? ' active' : ''}`}
        title={cameraMode === 'perspective' ? 'Switch to Orthographic' : 'Switch to Perspective'}
        onClick={toggleCamMode}
      >
        <Eye size={15} />
      </button>
      <button className="tool-btn" title="Fit to Scene (F)" onClick={handleFit}>
        <ZoomIn size={15} />
      </button>

      <div className="toolbar-sep-h" />

      {/* View presets */}
      <span className="toolbar-group-label">VIEWS</span>
      {VIEW_PRESETS.map(({ id, label }) => (
        <button
          key={id}
          className="tool-btn"
          title={`${id.charAt(0) + id.slice(1).toLowerCase()} View`}
          onClick={() => animateToView(id)}
        >
          <span className="tool-btn-text">{label}</span>
        </button>
      ))}

      <div className="toolbar-sep-h" />

      {/* Tools */}
      <span className="toolbar-group-label">TOOLS</span>
      <button
        className={`tool-btn${gridVisible ? ' active' : ''}`}
        title="Toggle Grid (G)"
        onClick={toggleGrid}
      >
        <Grid3X3 size={15} />
      </button>
      <button
        className={`tool-btn${measureMode ? ' active' : ''}`}
        title="Measure Distance (M)"
        onClick={toggleMeasureMode}
      >
        <Ruler size={15} />
      </button>
    </div>
  )
}
