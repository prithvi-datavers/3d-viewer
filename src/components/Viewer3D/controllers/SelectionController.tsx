import { useEffect } from 'react'
import { PointerEventTypes } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import { initHighlight, selectMesh, deselectMesh, isOverlayMesh } from '../../../lib/babylon/SelectionManager'

export default function SelectionController() {
  const scene = useViewerStore((s) => s.babylonScene)
  const measureMode = useViewerStore((s) => s.measureMode)
  const setSelection = useViewerStore((s) => s.setSelection)

  // Init HighlightLayer once when scene is ready
  useEffect(() => {
    if (!scene) return
    initHighlight(scene)
  }, [scene])

  useEffect(() => {
    if (!scene || measureMode) return

    const observer = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const mesh = info.pickInfo?.pickedMesh
      if (!mesh || isOverlayMesh(mesh.name)) {
        deselectMesh()
        setSelection(null, null)
        return
      }
      const selInfo = selectMesh(mesh)
      setSelection(mesh.name, selInfo)
    })

    return () => scene.onPointerObservable.remove(observer)
  }, [scene, measureMode, setSelection])

  return null
}
