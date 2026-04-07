import type { ArcRotateCamera, AbstractMesh } from '@babylonjs/core'
import { Camera, Vector3 } from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import type { ViewPreset } from '../../types/viewer'

export const VIEWS: Record<ViewPreset, { alpha: number; beta: number }> = {
  FRONT:  { alpha: -Math.PI / 2, beta: Math.PI / 2 },
  BACK:   { alpha: Math.PI / 2,  beta: Math.PI / 2 },
  RIGHT:  { alpha: 0,            beta: Math.PI / 2 },
  LEFT:   { alpha: Math.PI,      beta: Math.PI / 2 },
  TOP:    { alpha: -Math.PI / 2, beta: 0.001 },
  BOTTOM: { alpha: -Math.PI / 2, beta: Math.PI - 0.001 },
  ISO:    { alpha: -Math.PI / 4, beta: Math.PI / 3 },
}

export function animateToView(viewName: ViewPreset) {
  const cam = useViewerStore.getState().cameraRef
  if (!cam) return

  const view = VIEWS[viewName]
  const frames = 30
  let frame = 0
  const startAlpha = cam.alpha
  const startBeta = cam.beta

  // Normalize to shortest rotation path
  let dAlpha = view.alpha - startAlpha
  while (dAlpha > Math.PI) dAlpha -= 2 * Math.PI
  while (dAlpha < -Math.PI) dAlpha += 2 * Math.PI
  const targetAlpha = startAlpha + dAlpha

  const step = () => {
    frame++
    const t = frame / frames
    const s = t * t * (3 - 2 * t) // smoothstep
    cam.alpha = startAlpha + (targetAlpha - startAlpha) * s
    cam.beta = startBeta + (view.beta - startBeta) * s
    if (frame < frames) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

export function toggleOrtho(cam: ArcRotateCamera, canvasWidth: number, canvasHeight: number) {
  if (cam.mode === Camera.PERSPECTIVE_CAMERA) {
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    const orthoSize = cam.radius * Math.tan(cam.fov / 2)
    const aspect = canvasWidth / canvasHeight
    cam.orthoLeft = -orthoSize * aspect
    cam.orthoRight = orthoSize * aspect
    cam.orthoTop = orthoSize
    cam.orthoBottom = -orthoSize
  } else {
    cam.mode = Camera.PERSPECTIVE_CAMERA
  }
}

export function fitToScene(cam: ArcRotateCamera, meshes: AbstractMesh[]) {
  const model = meshes.filter((m) => m.name !== 'viewerGrid' && !m.name.startsWith('originAxis') && !m.name.startsWith('originTip'))
  if (model.length === 0) return

  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  model.forEach((m) => {
    const bb = m.getBoundingInfo().boundingBox
    minX = Math.min(minX, bb.minimumWorld.x)
    minY = Math.min(minY, bb.minimumWorld.y)
    minZ = Math.min(minZ, bb.minimumWorld.z)
    maxX = Math.max(maxX, bb.maximumWorld.x)
    maxY = Math.max(maxY, bb.maximumWorld.y)
    maxZ = Math.max(maxZ, bb.maximumWorld.z)
  })

  const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2)
  const diagonal = Math.sqrt(
    Math.pow(maxX - minX, 2) + Math.pow(maxY - minY, 2) + Math.pow(maxZ - minZ, 2)
  )

  cam.target = center
  cam.radius = diagonal * 1.2 || 10
}
