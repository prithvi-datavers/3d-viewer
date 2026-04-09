import type { AbstractMesh, Vector3 } from '@babylonjs/core'

export type ShadingMode = 'shaded' | 'wireframe' | 'shadedEdges'

export type CameraMode = 'perspective' | 'orthographic'

export type ViewPreset = 'FRONT' | 'BACK' | 'RIGHT' | 'LEFT' | 'TOP' | 'BOTTOM' | 'ISO'

export interface MeasurementEntry {
  id: string
  type: 'point-to-point'
  points: Vector3[]
  midpoint: Vector3
  value: number
  display: string
  meshes: AbstractMesh[]
}

export interface SelectionInfo {
  meshName: string
  width: number
  depth: number
  height: number
}

export interface PartEntry {
  name: string         // Babylon mesh name ("StepPart_0", "sampleBox", etc.)
  displayName: string  // Human-readable ("Part 1", "Box", etc.)
  color: string        // CSS hex color from material albedoColor
  visible: boolean
}
