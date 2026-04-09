/**
 * STEP loader — heavy OC/WASM work runs in a Web Worker.
 * Main thread receives raw geometry and builds Babylon meshes.
 */
import type { Scene, AbstractMesh } from '@babylonjs/core'
import { Mesh, TransformNode, VertexData, PBRMaterial, Color3, Vector3 } from '@babylonjs/core'
import type { StepPart } from './StepWorker'

export type StepProgressCallback = (msg: string) => void

const DEFAULT_COLORS = [
  '#B0B8C0', '#A0A8B0', '#8894A0', '#98A0A8', '#C0C8D0',
  '#7888A0', '#B8C0C8', '#9098A8', '#A8B0B8', '#8090A0',
]

// Singleton worker — created once, reused for every file load
let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./StepWorker.ts', import.meta.url), { type: 'module' })
  }
  return worker
}

export async function loadSTEP(
  file: File,
  scene: Scene,
  _onProgress: StepProgressCallback = () => {}
): Promise<AbstractMesh[]> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  // Send bytes to worker (transferable — zero-copy)
  const parts = await new Promise<StepPart[]>((resolve, reject) => {
    const w = getWorker()
    w.onmessage = (e) => {
      if (e.data.ok) resolve(e.data.parts)
      else reject(new Error(e.data.error))
    }
    w.onerror = (e) => reject(new Error(e.message))
    w.postMessage({ bytes }, [bytes.buffer])
  })

  if (parts.length === 0) throw new Error('No geometry found in STEP file')

  return buildMeshes(scene, parts)
}

function buildMeshes(scene: Scene, parts: StepPart[]): AbstractMesh[] {
  const wrapper = new TransformNode('STEPModelWrapper', scene)
  const result: AbstractMesh[] = []

  parts.forEach((part, idx) => {
    if (part.positions.length === 0) return
    const mesh = new Mesh(`StepPart_${idx}`, scene)
    const vd = new VertexData()
    vd.positions = part.positions
    vd.normals   = part.normals
    vd.indices   = part.indices
    vd.applyToMesh(mesh)

    const mat = new PBRMaterial(`stepMat_${idx}`, scene)
    mat.albedoColor   = Color3.FromHexString(DEFAULT_COLORS[idx % DEFAULT_COLORS.length])
    mat.roughness     = 0.35
    mat.metallic      = 0.4
    mat.clearCoat.isEnabled  = true
    mat.clearCoat.intensity  = 0.1
    mat.backFaceCulling = false
    mesh.material = mat
    mesh.parent   = wrapper
    result.push(mesh)
  })

  if (result.length === 0) { wrapper.dispose(); return result }

  // Auto-scale to fit viewport (~6 units)
  wrapper.computeWorldMatrix(true)
  const { min, max } = wrapper.getHierarchyBoundingVectors(true)
  const size   = max.subtract(min)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) { const s = 6 / maxDim; wrapper.scaling = new Vector3(s, s, s) }

  // Center
  wrapper.computeWorldMatrix(true)
  const scaled = wrapper.getHierarchyBoundingVectors(true)
  const center = Vector3.Center(scaled.min, scaled.max)
  wrapper.position = new Vector3(-center.x, -center.y, -scaled.min.z)

  return result
}
