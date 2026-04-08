import { Eye, Maximize2, Grid3X3, Layers, Ruler } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { fitToScene } from '../../lib/babylon/CameraManager'

export default function TopToolbar() {
  const cameraMode         = useViewerStore((s) => s.cameraMode)
  const setCameraMode      = useViewerStore((s) => s.setCameraMode)
  const shadingMode        = useViewerStore((s) => s.shadingMode)
  const setShadingMode     = useViewerStore((s) => s.setShadingMode)
  const gridVisible        = useViewerStore((s) => s.gridVisible)
  const toggleGrid         = useViewerStore((s) => s.toggleGrid)
  const measureMode        = useViewerStore((s) => s.measureMode)
  const toggleMeasureMode  = useViewerStore((s) => s.toggleMeasureMode)
  const babylonScene       = useViewerStore((s) => s.babylonScene)
  const cameraRef          = useViewerStore((s) => s.cameraRef)

  const handleFit = () => {
    if (babylonScene && cameraRef) fitToScene(cameraRef, babylonScene.meshes.slice())
  }
  const toggleCam = () => {
    setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
  }

  return (
    <div className="top-toolbar">
      <button
        className={`pill-btn${cameraMode === 'orthographic' ? ' active' : ''}`}
        title={cameraMode === 'perspective' ? 'Orthographic (P)' : 'Perspective (P)'}
        onClick={toggleCam}
      >
        <Eye size={15} strokeWidth={1.75} />
      </button>

      <button
        className="pill-btn"
        title="Fit to Scene (F)"
        onClick={handleFit}
      >
        <Maximize2 size={15} strokeWidth={1.75} />
      </button>

      <div className="pill-sep" />

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

      <button
        className={`pill-btn${measureMode ? ' active' : ''}`}
        title="Measure (M)"
        onClick={toggleMeasureMode}
      >
        <Ruler size={15} strokeWidth={1.75} />
      </button>
    </div>
  )
}
