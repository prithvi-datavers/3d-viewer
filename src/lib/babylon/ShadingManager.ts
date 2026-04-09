import type { AbstractMesh, Scene } from '@babylonjs/core'
import { Color4, Color3, Vector3, MeshBuilder } from '@babylonjs/core'
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

/** Remove any edge line meshes previously attached to a model mesh */
function removeEdgeLines(mesh: AbstractMesh) {
  const scene = mesh.getScene()
  const key = `__edgeLines_${mesh.uniqueId}`
  const existing = scene.getMeshByName(key)
  if (existing) existing.dispose()
}

/** Build explicit edge lines from a mesh's index buffer in renderingGroupId=1 */
function addEdgeLines(mesh: AbstractMesh) {
  const scene = mesh.getScene()
  const key = `__edgeLines_${mesh.uniqueId}`

  const positions = mesh.getVerticesData('position')
  const indices   = mesh.getIndices()
  if (!positions || !indices) return

  // Collect unique edges (each triangle has 3 edges; deduplicate by sorted pair)
  const edgeSet = new Set<string>()
  const edgeList: [number, number][] = []
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2]
    const pairs: [number, number][] = [[a, b], [b, c], [c, a]]
    pairs.forEach(([u, v]) => {
      const k = u < v ? `${u}_${v}` : `${v}_${u}`
      if (!edgeSet.has(k)) { edgeSet.add(k); edgeList.push([u, v]) }
    })
  }

  // Build line segments
  const wm = mesh.getWorldMatrix()
  const edgeColor = new Color4(0.05, 0.05, 0.08, 0.55)
  const lines = edgeList.map(([a, b]) => {
    const pa = new Vector3(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2])
    const pb = new Vector3(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2])
    return [
      Vector3.TransformCoordinates(pa, wm),
      Vector3.TransformCoordinates(pb, wm),
    ]
  })

  if (lines.length === 0) return

  const lineColors = lines.map(() => [edgeColor, edgeColor])
  const ls = MeshBuilder.CreateLineSystem(key, { lines, colors: lineColors, useVertexAlpha: true }, scene)
  ls.renderingGroupId = 1
  ls.isPickable = false
  ls.color = new Color3(0.05, 0.05, 0.08)
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

    // Always remove old edges first
    if (mesh.edgesRenderer) mesh.disableEdgesRendering()
    removeEdgeLines(mesh)

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
        addEdgeLines(mesh)
        break
    }
  })
}
