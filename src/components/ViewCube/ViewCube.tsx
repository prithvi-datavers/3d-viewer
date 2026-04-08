import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture,
  PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

// Face planes positioned just outside each cube face — plane UV is always correct
const FACE_DEFS = [
  { name: 'FRONT',  pos: [0, -0.502, 0]  as [number,number,number], rot: [ Math.PI/2, 0, 0]       as [number,number,number] },
  { name: 'BACK',   pos: [0,  0.502, 0]  as [number,number,number], rot: [-Math.PI/2, 0, Math.PI] as [number,number,number] },
  { name: 'RIGHT',  pos: [0.502,  0, 0]  as [number,number,number], rot: [0, 0, -Math.PI/2]       as [number,number,number] },
  { name: 'LEFT',   pos: [-0.502, 0, 0]  as [number,number,number], rot: [0, 0,  Math.PI/2]       as [number,number,number] },
  { name: 'TOP',    pos: [0, 0,  0.502]  as [number,number,number], rot: [0, 0, 0]                as [number,number,number] },
  { name: 'BOTTOM', pos: [0, 0, -0.502]  as [number,number,number], rot: [Math.PI, 0, 0]          as [number,number,number] },
]

const FACE_LABELS: Record<string, string> = {
  FRONT: 'FRONT', BACK: 'BACK', RIGHT: 'RIGHT', LEFT: 'LEFT', TOP: 'TOP', BOTTOM: 'BTM',
}

// Axis definitions — inner end (inside cube), outer end (badge position)
const AXIS_DEFS = [
  { label: 'X', inner: new Vector3(0.48, 0, 0),  outer: new Vector3(0.72, 0, 0),  hex: '#e53e3e' },
  { label: 'Y', inner: new Vector3(0, 0.48, 0),  outer: new Vector3(0, 0.72, 0),  hex: '#38a169' },
  { label: 'Z', inner: new Vector3(0, 0, 0.48),  outer: new Vector3(0, 0, 0.72),  hex: '#3182ce' },
]

function makeFaceTex(label: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`faceTex_${label}`, { width: 256, height: 256 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 256, 256)
  ctx.fillStyle = '#f8f8fb'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'
  ctx.lineWidth = 5
  ctx.strokeRect(2.5, 2.5, 251, 251)
  const fontSize = label.length >= 5 ? 40 : 50
  ctx.fillStyle = '#111111'
  ctx.font = `bold ${fontSize}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 128, 128)
  tex.update()
  return tex
}

function makeBadgeTex(label: string, hex: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`badgeTex_${label}`, { width: 128, height: 128 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 128, 128)
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fillStyle = hex
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 70px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 64, 66)
  tex.update()
  tex.hasAlpha = true
  return tex
}

export default function ViewCube() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const cubeCamRef    = useRef<ArcRotateCamera | null>(null)
  const mainCameraRef = useRef<ArcRotateCamera | null>(null)
  const mainCamera    = useViewerStore((s) => s.cameraRef)

  useEffect(() => { mainCameraRef.current = mainCamera }, [mainCamera])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: Engine
    let scene: Scene
    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
      scene  = new Scene(engine)
    } catch {
      return
    }

    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Orthographic camera
    const camera = new ArcRotateCamera('cubeCamera', -Math.PI / 4, Math.PI / 3, 2.8, Vector3.Zero(), scene)
    camera.upVector = new Vector3(0, 0, 1)
    camera.minZ = 0.01; camera.maxZ = 20
    camera.inputs.clear()
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    const oh = 0.95
    camera.orthoLeft = -oh; camera.orthoRight = oh
    camera.orthoTop  =  oh; camera.orthoBottom = -oh
    cubeCamRef.current = camera

    // Lights
    const hemi = new HemisphericLight('h', new Vector3(0, 0, 1), scene)
    hemi.intensity = 0.85; hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.6, 0.6, 0.65)
    const dir = new DirectionalLight('d', new Vector3(-1, -0.5, -1).normalize(), scene)
    dir.intensity = 0.4

    // Solid white cube body
    const box = MeshBuilder.CreateBox('cubeBody', { size: 1 }, scene)
    const boxMat = new StandardMaterial('cubeBodyMat', scene)
    boxMat.diffuseColor  = new Color3(0.96, 0.96, 0.98)
    boxMat.specularColor = new Color3(0.08, 0.08, 0.1)
    boxMat.specularPower = 32
    box.material = boxMat
    box.isPickable = false
    box.enableEdgesRendering()
    box.edgesWidth = 3.5
    box.edgesColor = new Color4(0.08, 0.08, 0.12, 1)

    // Face label planes — positioned just outside, UV always correct
    FACE_DEFS.forEach((def) => {
      const plane = MeshBuilder.CreatePlane(`face_${def.name}`, { size: 0.98 }, scene)
      plane.position = new Vector3(...def.pos)
      plane.rotation = new Vector3(...def.rot)

      const mat = new StandardMaterial(`faceMat_${def.name}`, scene)
      mat.diffuseTexture = makeFaceTex(FACE_LABELS[def.name], scene)
      mat.specularColor  = new Color3(0, 0, 0)
      mat.emissiveColor  = new Color3(0.08, 0.08, 0.08)
      mat.backFaceCulling = true
      plane.material = mat
      plane.metadata = { viewName: def.name }
    })

    // Axis lines — inside portion subtle, outside portion bold
    AXIS_DEFS.forEach((ax) => {
      const c = Color3.FromHexString(ax.hex)
      // Inside: origin → inner face (subtle, low alpha)
      MeshBuilder.CreateLines(`axIn_${ax.label}`, {
        points: [Vector3.Zero(), ax.inner],
        colors: [
          new Color4(c.r, c.g, c.b, 0.18),
          new Color4(c.r, c.g, c.b, 0.35),
        ],
      }, scene).isPickable = false

      // Outside: face → badge (bold, full alpha)
      MeshBuilder.CreateLines(`axOut_${ax.label}`, {
        points: [ax.inner, ax.outer],
        colors: [
          new Color4(c.r, c.g, c.b, 0.7),
          new Color4(c.r, c.g, c.b, 1.0),
        ],
      }, scene).isPickable = false
    })

    // Axis badge planes (billboarded colored circle + white letter)
    AXIS_DEFS.forEach((ax) => {
      const badge = MeshBuilder.CreatePlane(`badge_${ax.label}`, { size: 0.26 }, scene)
      badge.position = ax.outer.clone()
      badge.billboardMode = 7

      const mat = new StandardMaterial(`badgeMat_${ax.label}`, scene)
      mat.diffuseTexture = makeBadgeTex(ax.label, ax.hex, scene)
      mat.useAlphaFromDiffuseTexture = true
      mat.emissiveColor   = new Color3(1, 1, 1)
      mat.specularColor   = new Color3(0, 0, 0)
      mat.backFaceCulling = false
      badge.material   = mat
      badge.isPickable = false
    })

    // Click → animate main camera
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const viewName = info.pickInfo?.pickedMesh?.metadata?.viewName as ViewPreset | undefined
      if (viewName && VIEWS[viewName]) animateToView(viewName)
    })

    engine.runRenderLoop(() => {
      const mc = mainCameraRef.current
      if (mc && cubeCamRef.current) {
        cubeCamRef.current.alpha = mc.alpha
        cubeCamRef.current.beta  = mc.beta
      }
      scene.render()
    })

    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => { ro.disconnect(); scene.dispose(); engine.dispose(); cubeCamRef.current = null }
  }, [])

  return (
    <div className="viewcube-widget">
      <div className="viewcube-canvas-wrap">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', outline: 'none', cursor: 'pointer' }} />
      </div>
    </div>
  )
}
