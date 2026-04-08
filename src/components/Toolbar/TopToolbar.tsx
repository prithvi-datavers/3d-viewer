import { Eye, Maximize2, Grid3X3, Layers, MousePointer2 } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { fitToScene, animateToView } from '../../lib/babylon/CameraManager'
import { ViewCubeIcon } from './ViewIcons'
import type { ViewPreset } from '../../types/viewer'

const VIEW_PRESETS: { id: ViewPreset; face: Parameters<typeof ViewCubeIcon>[0]['face']; label: string }[] = [
  { id: 'FRONT',  face: 'front',  label: 'Front'  },
  { id: 'BACK',   face: 'back',   label: 'Back'   },
  { id: 'RIGHT',  face: 'right',  label: 'Right'  },
  { id: 'LEFT',   face: 'left',   label: 'Left'   },
  { id: 'TOP',    face: 'top',    label: 'Top'    },
  { id: 'BOTTOM', face: 'bottom', label: 'Bottom' },
  { id: 'ISO',    face: 'iso',    label: 'ISO'    },
]

export default function TopToolbar() {
  const cameraMode     = useViewerStore((s) => s.cameraMode)
  const setCameraMode  = useViewerStore((s) => s.setCameraMode)
  const shadingMode    = useViewerStore((s) => s.shadingMode)
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const gridVisible    = useViewerStore((s) => s.gridVisible)
  const toggleGrid     = useViewerStore((s) => s.toggleGrid)
  const selectedMeshName = useViewerStore((s) => s.selectedMeshName)
  const babylonScene   = useViewerStore((s) => s.babylonScene)
  const cameraRef      = useViewerStore((s) => s.cameraRef)

  const handleFit = () => {
    if (babylonScene && cameraRef) fitToScene(cameraRef, babylonScene.meshes.slice())
  }
  const toggleCam = () => {
    setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
  }

  return (
    <div className="top-toolbar">
      {/* Select */}
      <button
        className={`pill-btn${selectedMeshName ? ' active' : ''}`}
        title="Select"
      >
        <MousePointer2 size={15} strokeWidth={1.75} />
      </button>

      <div className="pill-sep" />

      {/* Camera / scene */}
      <button
        className={`pill-btn${cameraMode === 'orthographic' ? ' active' : ''}`}
        title={cameraMode === 'perspective' ? 'Orthographic (P)' : 'Perspective (P)'}
        onClick={toggleCam}
      >
        <Eye size={15} strokeWidth={1.75} />
      </button>
      <button className="pill-btn" title="Fit to Scene (F)" onClick={handleFit}>
        <Maximize2 size={15} strokeWidth={1.75} />
      </button>
      <button
        className={`pill-btn${shadingMode === 'wireframe' ? ' active' : ''}`}
        title="Wireframe (W)"
        onClick={() => setShadingMode(shadingMode === 'wireframe' ? 'shaded' : 'wireframe')}
      >
        <Layers size={15} strokeWidth={1.75} />
      </button>
      <button
        className={`pill-btn${gridVisible ? ' active' : ''}`}
        title="Toggle Grid (G)"
        onClick={toggleGrid}
      >
        <Grid3X3 size={15} strokeWidth={1.75} />
      </button>

      <div className="pill-sep" />

      {/* View presets */}
      {VIEW_PRESETS.map(({ id, face, label }) => (
        <button
          key={id}
          className="pill-btn"
          title={label}
          onClick={() => animateToView(id)}
        >
          <ViewCubeIcon face={face} size={17} />
        </button>
      ))}
    </div>
  )
}
