import { useEffect } from 'react'
import { useViewerStore } from '../../../store/viewerStore'
import { applyShadingMode, getModelMeshes } from '../../../lib/babylon/ShadingManager'

export default function ShadingController() {
  const scene = useViewerStore((s) => s.babylonScene)
  const shadingMode = useViewerStore((s) => s.shadingMode)

  useEffect(() => {
    if (!scene) return
    const meshes = getModelMeshes(scene)
    applyShadingMode(shadingMode, meshes)
  }, [scene, shadingMode])

  return null
}
