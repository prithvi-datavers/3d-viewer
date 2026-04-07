import { useEffect } from 'react'
import Viewer3D from './components/Viewer3D/Viewer3D'
import Toolbar from './components/Toolbar/Toolbar'
import TopBar from './components/TopBar/TopBar'
import PropertiesPanel from './components/PropertiesPanel/PropertiesPanel'
import { useViewerStore } from './store/viewerStore'
import { fitToScene } from './lib/babylon/CameraManager'
import { deselectMesh } from './lib/babylon/SelectionManager'

export default function App() {
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const toggleGrid = useViewerStore((s) => s.toggleGrid)
  const toggleMeasureMode = useViewerStore((s) => s.toggleMeasureMode)
  const setCameraMode = useViewerStore((s) => s.setCameraMode)
  const cameraMode = useViewerStore((s) => s.cameraMode)
  const cameraRef = useViewerStore((s) => s.cameraRef)
  const babylonScene = useViewerStore((s) => s.babylonScene)
  const setSelection = useViewerStore((s) => s.setSelection)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case 'w':
          setShadingMode('wireframe')
          break
        case 'g':
          toggleGrid()
          break
        case 'f':
          if (cameraRef && babylonScene) fitToScene(cameraRef, babylonScene.meshes.slice())
          break
        case 'p':
          setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
          break
        case 'm':
          toggleMeasureMode()
          break
        case 'escape':
          // Cancel measure + deselect
          const store = useViewerStore.getState()
          if (store.measureMode) store.toggleMeasureMode()
          deselectMesh()
          setSelection(null, null)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cameraMode, cameraRef, babylonScene])

  return (
    <div className="app-layout">
      <TopBar />
      <div className="app-body">
        <Toolbar />
        <Viewer3D />
        <PropertiesPanel />
      </div>
    </div>
  )
}
