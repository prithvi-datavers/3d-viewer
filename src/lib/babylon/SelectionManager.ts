import type { AbstractMesh, Scene } from '@babylonjs/core'
import { HighlightLayer, Color3 } from '@babylonjs/core'
import type { SelectionInfo } from '../../types/viewer'

let highlightLayer: HighlightLayer | null = null
let currentMesh: AbstractMesh | null = null

export function initHighlight(scene: Scene) {
  highlightLayer = new HighlightLayer('selectionHL', scene)
  highlightLayer.innerGlow = false
  highlightLayer.outerGlow = true
}

export function selectMesh(mesh: AbstractMesh): SelectionInfo {
  deselectMesh()
  if (highlightLayer) {
    highlightLayer.addMesh(mesh as any, Color3.FromHexString('#00d4ff'))
  }
  currentMesh = mesh

  const bb = mesh.getBoundingInfo().boundingBox
  const min = bb.minimumWorld
  const max = bb.maximumWorld

  return {
    meshName: mesh.name,
    width: parseFloat((max.x - min.x).toFixed(3)),
    depth: parseFloat((max.y - min.y).toFixed(3)),
    height: parseFloat((max.z - min.z).toFixed(3)),
  }
}

export function deselectMesh() {
  if (highlightLayer && currentMesh) {
    try { highlightLayer.removeMesh(currentMesh as any) } catch (_) {}
  }
  currentMesh = null
}

export function isOverlayMesh(name: string): boolean {
  const prefixes = ['viewerGrid', 'originAxis', 'originTip', 'measure_', 'pickMarker', 'marker_', 'face_', 'compass', 'cubeBody', 'axisStub']
  return prefixes.some((p) => name.startsWith(p))
}
