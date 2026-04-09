import type { Scene, AbstractMesh } from '@babylonjs/core'
import { SceneLoader, MeshBuilder, PBRMaterial, Color3, Vector3 } from '@babylonjs/core'
import { loadSTEP, type StepProgressCallback } from './StepLoader'
import type { PartEntry } from '../../types/viewer'

// ── Part entry helpers ────────────────────────────────────────────────────────

function getDisplayName(meshName: string, idx: number): string {
  if (meshName.startsWith('StepPart_')) return `Part ${idx + 1}`
  if (meshName === 'sampleBox')    return 'Box'
  if (meshName === 'sampleSphere') return 'Sphere'
  if (meshName === 'sampleCyl')    return 'Cylinder'
  return meshName.length > 22 ? meshName.slice(0, 20) + '…' : meshName
}

function getMeshColor(mesh: AbstractMesh): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mat = mesh.material as any
  const raw = mat?.albedoColor ?? mat?.diffuseColor
  if (!raw) return '#9aa0b0'
  const h = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${h(raw.r)}${h(raw.g)}${h(raw.b)}`
}

export function buildPartEntries(meshes: AbstractMesh[]): PartEntry[] {
  return meshes.map((mesh, i) => ({
    name: mesh.name,
    displayName: getDisplayName(mesh.name, i),
    color: getMeshColor(mesh),
    visible: true,
  }))
}

export async function loadFile(
  file: File,
  scene: Scene,
  onProgress?: StepProgressCallback
): Promise<AbstractMesh[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'stp' || ext === 'step') {
    return loadSTEP(file, scene, onProgress)
  }

  const url = URL.createObjectURL(file)
  try {
    const result = await SceneLoader.ImportMeshAsync('', '', url, scene, null, '.' + ext)
    return result.meshes.filter((m) => m.getTotalVertices() > 0)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function loadSampleGeometry(scene: Scene): AbstractMesh[] {
  const meshes: AbstractMesh[] = []

  const box = MeshBuilder.CreateBox('sampleBox', { width: 2, height: 1, depth: 1 }, scene)
  box.position = new Vector3(-2, 0, 0.5)
  const boxMat = new PBRMaterial('boxMat', scene)
  boxMat.albedoColor = Color3.FromHexString('#6c8ebf').toLinearSpace()
  boxMat.roughness = 0.5
  boxMat.metallic = 0.1
  box.material = boxMat
  meshes.push(box)

  const sphere = MeshBuilder.CreateSphere('sampleSphere', { diameter: 1.2, segments: 32 }, scene)
  sphere.position = new Vector3(0.5, 0, 0.6)
  const sphereMat = new PBRMaterial('sphereMat', scene)
  sphereMat.albedoColor = Color3.FromHexString('#d4a853').toLinearSpace()
  sphereMat.roughness = 0.3
  sphereMat.metallic = 0.2
  sphere.material = sphereMat
  meshes.push(sphere)

  const cyl = MeshBuilder.CreateCylinder('sampleCyl', { diameter: 0.8, height: 2, tessellation: 32 }, scene)
  cyl.position = new Vector3(2.5, 0, 1)
  const cylMat = new PBRMaterial('cylMat', scene)
  cylMat.albedoColor = Color3.FromHexString('#82b366').toLinearSpace()
  cylMat.roughness = 0.4
  cylMat.metallic = 0.1
  cyl.material = cylMat
  meshes.push(cyl)

  return meshes
}
