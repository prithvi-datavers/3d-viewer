import type { Scene, AbstractMesh } from '@babylonjs/core'
import { Vector3, MeshBuilder, StandardMaterial, Color3, Color4 } from '@babylonjs/core'
import type { MeasurementEntry } from '../../types/viewer'

let counter = 0

export function createPickMarker(scene: Scene, position: Vector3, name: string): AbstractMesh {
  const sphere = MeshBuilder.CreateSphere(name, { diameter: 0.08 }, scene) as AbstractMesh
  sphere.position = position.clone()
  const mat = new StandardMaterial(`${name}_mat`, scene)
  mat.diffuseColor = Color3.FromHexString('#00d4ff')
  mat.emissiveColor = Color3.FromHexString('#00d4ff').scale(0.5)
  sphere.material = mat
  sphere.isPickable = false
  sphere.renderingGroupId = 1
  return sphere
}

export function createLeaderLine(scene: Scene, p1: Vector3, p2: Vector3, name: string): AbstractMesh {
  const c = new Color4(0, 0.83, 1, 1)
  const line = MeshBuilder.CreateLines(name, {
    points: [p1, p2],
    colors: [c, c],
  }, scene) as AbstractMesh
  line.isPickable = false
  line.renderingGroupId = 1
  return line
}

export function buildMeasurement(
  scene: Scene,
  p1: Vector3,
  p2: Vector3,
  marker1: AbstractMesh,
  marker2: AbstractMesh
): MeasurementEntry {
  const id = `measure_${++counter}`
  const distance = Vector3.Distance(p1, p2)
  const midpoint = Vector3.Center(p1, p2)
  const leader = createLeaderLine(scene, p1, p2, `${id}_line`)

  const mm = distance * 1000
  const display = mm > 100 ? `${(mm / 10).toFixed(1)} cm` : `${mm.toFixed(2)} mm`

  return {
    id,
    type: 'point-to-point',
    points: [p1, p2],
    midpoint,
    value: distance,
    display,
    meshes: [marker1, marker2, leader],
  }
}
