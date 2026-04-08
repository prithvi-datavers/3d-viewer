import { Box, Layers, Grid3X3, Ruler, Eye, Maximize2 } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import type { ShadingMode, ViewPreset } from '../../types/viewer'
import { animateToView, fitToScene } from '../../lib/babylon/CameraManager'
import { ViewCubeIcon } from './ViewIcons'

const VIEW_PRESETS: { id: ViewPreset; face: Parameters<typeof ViewCubeIcon>[0]['face']; label: string }[] = [
  { id: 'FRONT',  face: 'front',  label: 'Front'  },
  { id: 'BACK',   face: 'back',   label: 'Back'   },
  { id: 'RIGHT',  face: 'right',  label: 'Right'  },
  { id: 'LEFT',   face: 'left',   label: 'Left'   },
  { id: 'TOP',    face: 'top',    label: 'Top'    },
  { id: 'BOTTOM', face: 'bottom', label: 'Bottom' },
  { id: 'ISO',    face: 'iso',    label: 'ISO'    },
]

export default function Toolbar() {
  const shadingMode   = useViewerStore((s) => s.shadingMode)
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const cameraMode    = useViewerStore((s) => s.cameraMode)
  const setCameraMode  = useViewerStore((s) => s.setCameraMode)
  const gridVisible   = useViewerStore((s) => s.gridVisible)
  const toggleGrid    = useViewerStore((s) => s.toggleGrid)
  const measureMode   = useViewerStore((s) => s.measureMode)
  const toggleMeasureMode = useViewerStore((s) => s.toggleMeasureMode)
  const babylonScene  = useViewerStore((s) => s.babylonScene)
  const cameraRef     = useViewerStore((s) => s.cameraRef)

  const handleFit = () => {
    if (babylonScene && cameraRef) fitToScene(cameraRef, babylonScene.meshes.slice())
  }
  const toggleCam = () => {
    setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
  }

  return (
    <>
      {/* ── Left floating panel ─────────────────────────────── */}
      <div className="fp fp-left">

        {/* Display modes */}
        <button
          className={`fp-btn${shadingMode === 'shaded' ? ' active' : ''}`}
          title="Solid"
          onClick={() => setShadingMode('shaded')}
        >
          <Box size={14} />
        </button>
        <button
          className={`fp-btn${shadingMode === 'wireframe' ? ' active' : ''}`}
          title="Wireframe"
          onClick={() => setShadingMode('wireframe')}
        >
          <Layers size={14} />
        </button>
        <button
          className={`fp-btn${shadingMode === 'shadedEdges' ? ' active' : ''}`}
          title="Solid + Edges"
          onClick={() => setShadingMode('shadedEdges')}
        >
          <Grid3X3 size={14} />
        </button>

        <div className="fp-sep" />

        {/* Camera & scene tools */}
        <button
          className={`fp-btn${cameraMode === 'orthographic' ? ' active' : ''}`}
          title={cameraMode === 'perspective' ? 'Orthographic (P)' : 'Perspective (P)'}
          onClick={toggleCam}
        >
          <Eye size={14} />
        </button>
        <button
          className="fp-btn"
          title="Fit to Scene (F)"
          onClick={handleFit}
        >
          <Maximize2 size={14} />
        </button>

        <div className="fp-sep" />

        {/* Misc tools */}
        <button
          className={`fp-btn${gridVisible ? ' active' : ''}`}
          title="Toggle Grid (G)"
          onClick={toggleGrid}
        >
          <Grid3X3 size={14} strokeWidth={1.25} />
        </button>
        <button
          className={`fp-btn${measureMode ? ' active' : ''}`}
          title="Measure Distance (M)"
          onClick={toggleMeasureMode}
        >
          <Ruler size={14} />
        </button>
      </div>

      {/* ── Bottom view-preset panel ─────────────────────────── */}
      <div className="fp fp-views">
        {VIEW_PRESETS.map(({ id, face, label }) => (
          <button
            key={id}
            className="fp-view-btn"
            onClick={() => animateToView(id)}
          >
            <ViewCubeIcon face={face} size={18} />
            <span className="fp-view-label">{label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
