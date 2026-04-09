import type { AbstractMesh, Scene } from '@babylonjs/core'
import { Color4 } from '@babylonjs/core'
import type { ShadingMode } from '../../types/viewer'

const SKIP_PREFIXES = ['viewerGrid', 'originAxis', 'originTip', 'measure_', 'pickMarker', 'marker_']

export function getModelMeshes(scene: Scene): AbstractMesh[] {
  return scene.meshes.filter(
    (m) =>
      m.material &&
      m.getTotalVertices() > 0 &&
      !SKIP_PREFIXES.some((p) => m.name.startsWith(p))
  )
}

export function applyShadingMode(mode: ShadingMode, meshes: AbstractMesh[]) {
  if (!meshes.length) return

  meshes.forEach((mesh) => {
    const mat = mesh.material as any
    if (!mat) return

    // Store originals on first call
    if (!mat.metadata?._orig) {
      mat.metadata = mat.metadata || {}
      mat.metadata._orig = {
        wireframe: mat.wireframe ?? false,
        alpha: mat.alpha ?? 1,
        backFaceCulling: mat.backFaceCulling ?? true,
        roughness: mat.roughness,
        metallic: mat.metallic,
      }
    }

    // Reset edges
    if (mesh.edgesRenderer) mesh.disableEdgesRendering()

    switch (mode) {
      case 'shaded':
        mat.wireframe = false
        mat.alpha = mat.metadata._orig.alpha
        mat.backFaceCulling = mat.metadata._orig.backFaceCulling
        if (mat.roughness !== undefined) mat.roughness = mat.metadata._orig.roughness
        if (mat.metallic !== undefined) mat.metallic = mat.metadata._orig.metallic
        break

      case 'wireframe':
        mat.wireframe = true
        break

      case 'shadedEdges':
        mat.wireframe = false
        mat.alpha = mat.metadata._orig.alpha
        mat.backFaceCulling = mat.metadata._orig.backFaceCulling
        if (mat.roughness !== undefined) mat.roughness = mat.metadata._orig.roughness
        if (mat.metallic !== undefined) mat.metallic = mat.metadata._orig.metallic
        mesh.enableEdgesRendering()
        mesh.edgesWidth = 1.5
        mesh.edgesColor = new Color4(0, 0, 0, 0.6)
        break
    }
  })
}
