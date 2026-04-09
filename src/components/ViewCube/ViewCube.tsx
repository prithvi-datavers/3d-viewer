import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture,
  PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

// Face planes at ±0.501 — just outside the solid cube body (0.001 sub-pixel offset)
// LEFT/RIGHT use Y-axis rotation so the plane lies in YZ world space (not XY horizontal)
const FACE_DEFS = [
  { name: 'FRONT',  pos: [0, -0.501, 0]  as [number,number,number], rot: [ Math.PI/2, 0, 0]                   as [number,number,number] },
  { name: 'BACK',   pos: [0,  0.501, 0]  as [number,number,number], rot: [-Math.PI/2, 0, Math.PI]             as [number,number,number] },
  { name: 'RIGHT',  pos: [0.501,  0, 0]  as [number,number,number], rot: [0,  Math.PI/2,  Math.PI/2]          as [number,number,number] },
  { name: 'LEFT',   pos: [-0.501, 0, 0]  as [number,number,number], rot: [0, -Math.PI/2, -Math.PI/2]          as [number,number,number] },
  { name: 'TOP',    pos: [0, 0,  0.501]  as [number,number,number], rot: [0, 0, 0]                            as [number,number,number] },
  { name: 'BOTTOM', pos: [0, 0, -0.501]  as [number,number,number], rot: [Math.PI, 0, 0]                      as [number,number,number] },
]

const FACE_LABELS: Record<string, string> = {
  FRONT: 'FRONT', BACK: 'BACK', RIGHT: 'RIGHT', LEFT: 'LEFT', TOP: 'TOP', BOTTOM: 'BTM',
}

// Axis: inner = at face, outer = badge position
const AXIS_DEFS = [
  { label: 'X', inner: new Vector3(0.5, 0, 0),  outer: new Vector3(0.72, 0, 0),  hex: '#e53e3e' },
  { label: 'Y', inner: new Vector3(0, 0.5, 0),  outer: new Vector3(0, 0.72, 0),  hex: '#38a169' },
  { label: 'Z', inner: new Vector3(0, 0, 0.5),  outer: new Vector3(0, 0, 0.72),  hex: '#3182ce' },
]

function makeFaceTex(label: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`faceTex_${label}`, { width: 256, height: 256 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.fillStyle = '#f7f7fa'
  ctx.fillRect(0, 0, 256, 256)
  // No border stroke — cube body edge lines define the outline
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

    // Lights — even illumination, face planes show as uniform white
    const hemi = new HemisphericLight('h', new Vector3(0, 0, 1), scene)
    hemi.intensity = 1.0; hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.8, 0.8, 0.82)
    const dir = new DirectionalLight('d', new Vector3(-1, -0.5, -1).normalize(), scene)
    dir.intensity = 0.2

    // ── Solid opaque cube body — fills interior so back planes never show ─
    const box = MeshBuilder.CreateBox('cubeBody', { size: 1 }, scene)
    const boxMat = new StandardMaterial('cubeBodyMat', scene)
    boxMat.emissiveColor  = new Color3(0.96, 0.96, 0.98)
    boxMat.disableLighting = true
    boxMat.alpha = 0.35
    box.material   = boxMat
    box.isPickable = false

    // ── Face planes at ±0.501 (0.001 above cube surface, sub-pixel) ───────
    FACE_DEFS.forEach((def) => {
      const plane = MeshBuilder.CreatePlane(`face_${def.name}`, { size: 1.0 }, scene)
      plane.position = new Vector3(...def.pos)
      plane.rotation = new Vector3(...def.rot)
      const mat = new StandardMaterial(`faceMat_${def.name}`, scene)
      mat.emissiveTexture = makeFaceTex(FACE_LABELS[def.name], scene)
      mat.disableLighting = true
      mat.alpha = 0.88
      mat.backFaceCulling = true
      plane.material = mat
      plane.metadata = { viewName: def.name }
    })

    // ── 12 explicit edge lines — always solid at every angle ─────────────
    const h = 0.5
    const corners: [number,number,number][] = [
      [-h,-h,-h],[h,-h,-h],[h,h,-h],[-h,h,-h],
      [-h,-h, h],[h,-h, h],[h,h, h],[-h,h, h],
    ]
    const edgePairs: [number,number][] = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
    ]
    const ec = new Color4(0.05, 0.05, 0.08, 0.45)
    edgePairs.forEach(([a, b], i) => {
      const ln = MeshBuilder.CreateLines(`edge_${i}`, {
        points: [new Vector3(...corners[a]), new Vector3(...corners[b])],
        colors: [ec, ec],
      }, scene)
      ln.isPickable = false
    })

    // ── Axis lines: inside subtle, outside bold ───────────────────────────
    AXIS_DEFS.forEach((ax) => {
      const c = Color3.FromHexString(ax.hex)
      // Inside: origin → face (subtle)
      MeshBuilder.CreateLines(`axIn_${ax.label}`, {
        points: [Vector3.Zero(), ax.inner],
        colors: [new Color4(c.r, c.g, c.b, 0.15), new Color4(c.r, c.g, c.b, 0.30)],
      }, scene).isPickable = false
      // Outside: face → badge (bold)
      MeshBuilder.CreateLines(`axOut_${ax.label}`, {
        points: [ax.inner, ax.outer],
        colors: [new Color4(c.r, c.g, c.b, 0.65), new Color4(c.r, c.g, c.b, 1.0)],
      }, scene).isPickable = false
    })

    // ── Axis badge planes (billboarded, colored circle + white letter) ────
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

    // ── Click → animate main camera ───────────────────────────────────────
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
