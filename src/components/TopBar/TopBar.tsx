import { useRef } from 'react'
import { Upload, Maximize2 } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { loadFile, loadSampleGeometry } from '../../lib/babylon/ModelLoader'
import { applyShadingMode, getModelMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'

interface Props {
  onFileLoaded?: (name: string) => void
}

export default function TopBar({ onFileLoaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const babylonScene = useViewerStore((s) => s.babylonScene)
  const cameraRef = useViewerStore((s) => s.cameraRef)
  const shadingMode = useViewerStore((s) => s.shadingMode)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !babylonScene || !cameraRef) return
    const toRemove = getModelMeshes(babylonScene)
    toRemove.forEach((m) => m.dispose())
    try {
      const meshes = await loadFile(file, babylonScene)
      applyShadingMode(shadingMode, meshes)
      fitToScene(cameraRef, babylonScene.meshes.slice())
      onFileLoaded?.(file.name)
    } catch (err) {
      console.error('Load error:', err)
    }
    e.target.value = ''
  }

  const handleLoadSample = () => {
    if (!babylonScene || !cameraRef) return
    const toRemove = getModelMeshes(babylonScene)
    toRemove.forEach((m) => m.dispose())
    const meshes = loadSampleGeometry(babylonScene)
    applyShadingMode(shadingMode, meshes)
    fitToScene(cameraRef, babylonScene.meshes.slice())
    onFileLoaded?.('Sample Geometry')
  }

  return (
    <div className="topbar">
      <span className="topbar-title">3D Viewer</span>
      <div className="topbar-sep" />

      <button className="topbar-btn" onClick={() => fileInputRef.current?.click()}>
        <Upload size={13} />
        Load GLTF / GLB
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <button className="topbar-btn" onClick={handleLoadSample}>
        <Maximize2 size={13} />
        Load Sample
      </button>

      <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.4 }}>
        Drag &amp; drop GLB / GLTF onto viewport
      </span>
    </div>
  )
}
