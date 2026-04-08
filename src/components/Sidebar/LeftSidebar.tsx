import { useRef } from 'react'
import { Upload, LayoutGrid, Ruler } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { loadFile } from '../../lib/babylon/ModelLoader'
import { applyShadingMode, getModelMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'
import type { ReactNode } from 'react'

export type SidebarPanel = 'measure' | 'tree'

const PANEL_ITEMS: { id: SidebarPanel; icon: ReactNode; label: string }[] = [
  { id: 'measure', icon: <Ruler      size={18} strokeWidth={1.75} />, label: 'Measure' },
  { id: 'tree',    icon: <LayoutGrid size={18} strokeWidth={1.75} />, label: 'Tree'    },
]

interface Props {
  activePanel: SidebarPanel | null
  onSelect: (panel: SidebarPanel | null) => void
}

export default function LeftSidebar({ activePanel, onSelect }: Props) {
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const babylonScene    = useViewerStore((s) => s.babylonScene)
  const cameraRef       = useViewerStore((s) => s.cameraRef)
  const shadingMode     = useViewerStore((s) => s.shadingMode)
  const setLoadedFileName = useViewerStore((s) => s.setLoadedFileName)
  const setLoadingMsg   = useViewerStore((s) => s.setLoadingMsg)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !babylonScene || !cameraRef) return
    getModelMeshes(babylonScene).forEach((m) => m.dispose())
    try {
      const meshes = await loadFile(file, babylonScene, (msg) => setLoadingMsg(msg || null))
      applyShadingMode(shadingMode, meshes)
      fitToScene(cameraRef, babylonScene.meshes.slice())
      setLoadedFileName(file.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Failed to load file:\n${msg}`)
    } finally {
      setLoadingMsg(null)
    }
    e.target.value = ''
  }

  return (
    <div className="left-sidebar">
      <div
        className="sidebar-item sidebar-action"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={18} strokeWidth={1.75} />
        <span className="sidebar-item-label">Load</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.stp,.step"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="sidebar-sep" />

      {PANEL_ITEMS.map(({ id, icon, label }) => (
        <div
          key={id}
          className={`sidebar-item${activePanel === id ? ' active' : ''}`}
          onClick={() => onSelect(activePanel === id ? null : id)}
        >
          {icon}
          <span className="sidebar-item-label">{label}</span>
        </div>
      ))}
    </div>
  )
}
