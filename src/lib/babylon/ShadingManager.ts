import type { AbstractMesh, Scene } from '@babylonjs/core'
import { Color4, Vector3, MeshBuilder } from '@babylonjs/core'
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

/**
 * Build hard/feature edge lines from a mesh's index buffer.
 * Only draws edges where two adjacent triangles meet at an angle > threshold.
 * Boundary edges (only one adjacent triangle) are also drawn.
 * This avoids drawing internal quad-diagonal edges that make it look like wireframe.
 */
function addEdgeLines(mesh: AbstractMesh, angleThresholdDeg = 15) {
  const scene = mesh.getScene()
  const key = `__edgeLines_${mesh.uniqueId}`

  const positions = mesh.getVerticesData('position')
  const indices   = mesh.getIndices()
  if (!positions || !indices) return

  const cosThreshold = Math.cos((angleThresholdDeg * Math.PI) / 180)

  // Compute face normal for each triangle
  const faceNormals: Vector3[] = []
  for (let i = 0; i < indices.length; i += 3) {
    const ai = indices[i] * 3, bi = indices[i+1] * 3, ci = indices[i+2] * 3
    const pa = new Vector3(positions[ai], positions[ai+1], positions[ai+2])
    const pb = new Vector3(positions[bi], positions[bi+1], positions[bi+2])
    const pc = new Vector3(positions[ci], positions[ci+1], positions[ci+2])
    faceNormals.push(Vector3.Cross(pb.subtract(pa), pc.subtract(pa)).normalize())
  }

  // Map each edge (sorted vertex pair) → list of face indices that use it
  const edgeToFaces = new Map<string, number[]>()
  for (let f = 0; f < indices.length / 3; f++) {
    const tri = [indices[f*3], indices[f*3+1], indices[f*3+2]]
    for (let e = 0; e < 3; e++) {
      const u = tri[e], v = tri[(e+1) % 3]
      const k = u < v ? `${u}_${v}` : `${v}_${u}`
      const arr = edgeToFaces.get(k)
      if (arr) arr.push(f); else edgeToFaces.set(k, [f])
    }
  }

  // Keep only hard edges: boundary (1 face) or dihedral angle > threshold
  const hardEdges: [number, number][] = []
  edgeToFaces.forEach((faces, k) => {
    if (faces.length === 1) {
      // boundary edge — always draw
      const [u, v] = k.split('_').map(Number)
      hardEdges.push([u, v])
    } else if (faces.length === 2) {
      const dot = Vector3.Dot(faceNormals[faces[0]], faceNormals[faces[1]])
      if (dot < cosThreshold) {
        const [u, v] = k.split('_').map(Number)
        hardEdges.push([u, v])
      }
    }
  })

  if (hardEdges.length === 0) return

  const wm = mesh.getWorldMatrix()
  const edgeColor = new Color4(0.05, 0.05, 0.08, 0.18)
  const lines = hardEdges.map(([a, b]) => {
    const pa = new Vector3(positions[a*3], positions[a*3+1], positions[a*3+2])
    const pb = new Vector3(positions[b*3], positions[b*3+1], positions[b*3+2])
    return [Vector3.TransformCoordinates(pa, wm), Vector3.TransformCoordinates(pb, wm)]
  })

  const lineColors = lines.map(() => [edgeColor, edgeColor])
  const ls = MeshBuilder.CreateLineSystem(key, { lines, colors: lineColors, useVertexAlpha: true }, scene)
  ls.renderingGroupId = 1
  ls.isPickable = false
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
