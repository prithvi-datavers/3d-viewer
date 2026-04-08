import { useRef, useEffect } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  PointerEventTypes,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

const FACE_DEFS = [
  { name: 'FRONT',  pos: [0, -0.51, 0] as [number,number,number], rot: [Math.PI / 2, 0, 0] as [number,number,number],        color: '#6366f1', text: 'F' },
  { name: 'BACK',   pos: [0, 0.51, 0]  as [number,number,number], rot: [-Math.PI / 2, 0, Math.PI] as [number,number,number],  color: '#6366f1', text: 'Bk' },
  { name: 'RIGHT',  pos: [0.51, 0, 0]  as [number,number,number], rot: [0, 0, -Math.PI / 2] as [number,number,number],        color: '#10b981', text: 'R' },
  { name: 'LEFT',   pos: [-0.51, 0, 0] as [number,number,number], rot: [0, 0, Math.PI / 2] as [number,number,number],         color: '#10b981', text: 'L' },
  { name: 'TOP',    pos: [0, 0, 0.51]  as [number,number,number], rot: [0, 0, 0] as [number,number,number],                   color: '#f59e0b', text: 'T' },
  { name: 'BOTTOM', pos: [0, 0, -0.51] as [number,number,number], rot: [Math.PI, 0, 0] as [number,number,number],             color: '#f59e0b', text: 'Bo' },
]

const VIEW_PRESETS: { id: ViewPreset; label: string; tip: string }[] = [
  { id: 'FRONT',  label: 'F',   tip: 'Front View' },
  { id: 'BACK',   label: 'Bk',  tip: 'Back View' },
  { id: 'RIGHT',  label: 'R',   tip: 'Right View' },
  { id: 'LEFT',   label: 'L',   tip: 'Left View' },
  { id: 'TOP',    label: 'T',   tip: 'Top View' },
  { id: 'BOTTOM', label: 'Bo',  tip: 'Bottom View' },
  { id: 'ISO',    label: 'ISO', tip: 'Isometric View' },
]

export default function ViewCube() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cubeCamRef = useRef<ArcRotateCamera | null>(null)
  const mainCamera = useViewerStore((s) => s.cameraRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
    const scene = new Scene(engine)
    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)  // transparent, shows widget bg
    scene.autoClear = true
    scene.autoClearDepthAndStencil = true

    const camera = new ArcRotateCamera('cubeCamera', -Math.PI / 4, Math.PI / 3, 2.4, Vector3.Zero(), scene)
    camera.upVector = new Vector3(0, 0, 1)
    camera.minZ = 0.01
    camera.maxZ = 20
    camera.inputs.clear()
    cubeCamRef.current = camera

    const light = new HemisphericLight('cubeLight', new Vector3(0.5, 0.3, 1), scene)
    light.intensity = 1.5
    light.diffuse = new Color3(1, 1, 1)
    light.groundColor = new Color3(0.6, 0.6, 0.65)

    // Cube body
    const box = MeshBuilder.CreateBox('cubeBody', { size: 1 }, scene)
    const boxMat = new StandardMaterial('cubeBodyMat', scene)
    boxMat.diffuseColor = Color3.FromHexString('#dde1ea')
    boxMat.specularColor = new Color3(0.2, 0.2, 0.22)
    boxMat.alpha = 0.90
    box.material = boxMat
    box.isPickable = false

    // Face planes with labels
    FACE_DEFS.forEach((def) => {
      const plane = MeshBuilder.CreatePlane(`face_${def.name}`, { size: 0.96 }, scene)
      plane.position = new Vector3(...def.pos)
      plane.rotation = new Vector3(...def.rot)

      const tex = new DynamicTexture(`tex_${def.name}`, { width: 256, height: 256 }, scene, false)
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
      ctx.fillStyle = def.color
      ctx.fillRect(0, 0, 256, 256)
      // Dark edge border
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'
      ctx.lineWidth = 14
      ctx.strokeRect(7, 7, 242, 242)
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 60px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(def.text, 128, 128)
      tex.update()

      const mat = new StandardMaterial(`mat_${def.name}`, scene)
      mat.diffuseTexture = tex
      mat.specularColor = new Color3(0.05, 0.05, 0.05)
      mat.emissiveColor = new Color3(0.15, 0.15, 0.15)
      mat.backFaceCulling = true
      plane.material = mat
      plane.metadata = { viewName: def.name }
    })

    // Compass ring
    const compassZ = -0.65
    const ring = MeshBuilder.CreateTorus('compassRing', { diameter: 0.85 * 2, thickness: 0.04, tessellation: 64 }, scene)
    ring.position.z = compassZ
    const ringMat = new StandardMaterial('ringMat', scene)
    ringMat.diffuseColor = new Color3(0.7, 0.7, 0.75)
    ringMat.emissiveColor = new Color3(0.3, 0.3, 0.32)
    ringMat.alpha = 0.7
    ring.material = ringMat
    ring.isPickable = false

    createCompassAxis(scene, compassZ, 0.85, 0.45, 'X', '#ef4444', new Vector3(1, 0, 0))
    createCompassAxis(scene, compassZ, 0.85, 0.45, 'Y', '#22c55e', new Vector3(0, 1, 0))
    createAxisStub(scene, new Vector3(0, 0, 0.55), new Vector3(0, 0, 1.0), '#3b82f6', 'Z')

    // Click → animate main camera
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const viewName = info.pickInfo?.pickedMesh?.metadata?.viewName as ViewPreset | undefined
      if (viewName && VIEWS[viewName]) animateToView(viewName)
    })

    engine.runRenderLoop(() => {
      if (mainCamera && cubeCamRef.current) {
        cubeCamRef.current.alpha = mainCamera.alpha
        cubeCamRef.current.beta = mainCamera.beta
      }
      scene.render()
    })

    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => {
      ro.disconnect()
      scene.dispose()
      engine.dispose()
    }
  }, [mainCamera])

  return (
    <div className="viewcube-widget">
      <div className="viewcube-canvas-wrap">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', outline: 'none', cursor: 'pointer' }} />
      </div>
    </div>
  )
}

function createCompassAxis(
  scene: Scene, z: number, ringRadius: number, length: number,
  label: string, hexColor: string, direction: Vector3
) {
  const color = Color3.FromHexString(hexColor)
  const c4 = new Color4(color.r, color.g, color.b, 1)
  const origin = new Vector3(0, 0, z)
  const end = origin.add(direction.scale(ringRadius + length))
  const from = origin.add(direction.scale(ringRadius * 0.3))

  const line = MeshBuilder.CreateLines(`compass_${label}`, { points: [from, end], colors: [c4, c4] }, scene)
  line.isPickable = false

  const tip = MeshBuilder.CreateSphere(`compassTip_${label}`, { diameter: 0.1 }, scene)
  tip.position = end
  const mat = new StandardMaterial(`compassTipMat_${label}`, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.5)
  tip.material = mat
  tip.isPickable = false

  const labelPlane = MeshBuilder.CreatePlane(`compassLabel_${label}`, { size: 0.22 }, scene)
  labelPlane.position = end.add(direction.scale(0.18))
  labelPlane.position.z = z
  labelPlane.billboardMode = 7

  const tex = new DynamicTexture(`compassLabelTex_${label}`, { width: 64, height: 64 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = hexColor
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 32, 32)
  tex.update()
  tex.hasAlpha = true

  const lMat = new StandardMaterial(`compassLabelMat_${label}`, scene)
  lMat.diffuseTexture = tex
  lMat.emissiveColor = color.scale(0.6)
  lMat.useAlphaFromDiffuseTexture = true
  lMat.backFaceCulling = false
  labelPlane.material = lMat
  labelPlane.isPickable = false
}

function createAxisStub(scene: Scene, from: Vector3, to: Vector3, hexColor: string, label: string) {
  const color = Color3.FromHexString(hexColor)
  const c4 = new Color4(color.r, color.g, color.b, 1)

  const line = MeshBuilder.CreateLines(`axisStub_${label}`, { points: [from, to], colors: [c4, c4] }, scene)
  line.isPickable = false

  const tip = MeshBuilder.CreateSphere(`axisStubTip_${label}`, { diameter: 0.1 }, scene)
  tip.position = to.clone()
  const mat = new StandardMaterial(`axisStubMat_${label}`, scene)
  mat.diffuseColor = color
  mat.emissiveColor = color.scale(0.5)
  tip.material = mat
  tip.isPickable = false

  const direction = to.subtract(from).normalize()
  const labelPlane = MeshBuilder.CreatePlane(`axisStubLabel_${label}`, { size: 0.22 }, scene)
  labelPlane.position = to.add(direction.scale(0.18))
  labelPlane.billboardMode = 7

  const tex = new DynamicTexture(`axisStubLabelTex_${label}`, { width: 64, height: 64 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 64, 64)
  ctx.fillStyle = hexColor
  ctx.font = 'bold 40px Arial'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 32, 32)
  tex.update()
  tex.hasAlpha = true

  const lMat = new StandardMaterial(`axisStubLabelMat_${label}`, scene)
  lMat.diffuseTexture = tex
  lMat.emissiveColor = color.scale(0.6)
  lMat.useAlphaFromDiffuseTexture = true
  lMat.backFaceCulling = false
  labelPlane.material = lMat
  labelPlane.isPickable = false
}
