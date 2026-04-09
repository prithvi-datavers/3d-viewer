import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture,
  PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

// ── Constants ─────────────────────────────────────────────────────────────────

const FACE_OFFSET = 0.501   // just outside cube surface to avoid z-fighting
const BADGE_DIST  = 0.72    // axis badge position

// Face planes — rotations verified non-mirroring
const FACES = [
  { name: 'TOP',    label: 'TOP',   pos: new Vector3(0, 0,  FACE_OFFSET), rot: new Vector3(0, 0, 0) },
  { name: 'BOTTOM', label: 'BTM',   pos: new Vector3(0, 0, -FACE_OFFSET), rot: new Vector3(Math.PI, 0, 0) },
  { name: 'FRONT',  label: 'FRONT', pos: new Vector3(0, -FACE_OFFSET, 0), rot: new Vector3(Math.PI / 2, 0, 0) },
  { name: 'BACK',   label: 'BACK',  pos: new Vector3(0,  FACE_OFFSET, 0), rot: new Vector3(-Math.PI / 2, 0, Math.PI) },
  { name: 'RIGHT',  label: 'RIGHT', pos: new Vector3( FACE_OFFSET, 0, 0), rot: new Vector3(0,  Math.PI / 2,  Math.PI / 2) },
  { name: 'LEFT',   label: 'LEFT',  pos: new Vector3(-FACE_OFFSET, 0, 0), rot: new Vector3(0, -Math.PI / 2, -Math.PI / 2) },
]

const AXES = [
  { label: 'X', dir: new Vector3(1, 0, 0), hex: '#e53e3e' },
  { label: 'Y', dir: new Vector3(0, 1, 0), hex: '#38a169' },
  { label: 'Z', dir: new Vector3(0, 0, 1), hex: '#3182ce' },
]

// 12 cube edge segments
const H = 0.5
const CORNERS: Vector3[] = [
  new Vector3(-H,-H,-H), new Vector3( H,-H,-H), new Vector3( H, H,-H), new Vector3(-H, H,-H),
  new Vector3(-H,-H, H), new Vector3( H,-H, H), new Vector3( H, H, H), new Vector3(-H, H, H),
]
const EDGE_PAIRS: [number, number][] = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
]

// ── Texture helpers ────────────────────────────────────────────────────────────

function createFaceTexture(label: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`ft_${label}`, { width: 256, height: 256 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.fillStyle = '#f8f8fc'
  ctx.fillRect(0, 0, 256, 256)
  const fs = label.length >= 5 ? 42 : 52
  ctx.fillStyle = '#1a1a2e'
  ctx.font = `bold ${fs}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 128, 128)
  tex.update()
  return tex
}

function createBadgeTexture(label: string, hex: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`bt_${label}`, { width: 128, height: 128 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 128, 128)
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fillStyle = hex
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 72px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 64, 66)
  tex.update()
  tex.hasAlpha = true
  return tex
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ViewCube() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const cubeCamRef    = useRef<ArcRotateCamera | null>(null)
  const mainCameraRef = useRef<ArcRotateCamera | null>(null)
  const mainCamera    = useViewerStore((s) => s.cameraRef)

  // Keep latest main camera accessible in render loop without re-running init
  useEffect(() => { mainCameraRef.current = mainCamera }, [mainCamera])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Engine & Scene ──────────────────────────────────────────────────────
    let engine: Engine, scene: Scene
    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
      scene  = new Scene(engine)
    } catch { return }

    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Rendering groups:
    //   0 = cube body + face planes  (normal depth test)
    //   1 = cube edges               (depth preserved from group 0, no z-fight)
    //   2 = inner axis lines         (depth cleared, always on top — simulate "inside" with low alpha)
    //   3 = outer axes + badges      (depth cleared, always on top, dynamic alpha for front/back)
    scene.setRenderingAutoClearDepthStencil(1, false) // edges: keep group-0 depth
    scene.setRenderingAutoClearDepthStencil(2, true)  // inner axes: fresh depth (always visible)
    scene.setRenderingAutoClearDepthStencil(3, true)  // badges: fresh depth (always visible)

    // ── Camera ──────────────────────────────────────────────────────────────
    const cam = new ArcRotateCamera('vc', -Math.PI / 4, Math.PI / 3, 2.8, Vector3.Zero(), scene)
    cam.upVector = new Vector3(0, 0, 1)
    cam.minZ = 0.01; cam.maxZ = 20
    cam.inputs.clear()
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    const oh = 0.95
    cam.orthoLeft = -oh; cam.orthoRight = oh
    cam.orthoTop = oh; cam.orthoBottom = -oh
    cubeCamRef.current = cam

    // ── Light ───────────────────────────────────────────────────────────────
    const hemi = new HemisphericLight('h', new Vector3(0, 0, 1), scene)
    hemi.intensity = 1; hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.8, 0.8, 0.85)

    // ── Group 0: cube body ───────────────────────────────────────────────────
    const body = MeshBuilder.CreateBox('body', { size: 1 }, scene)
    const bodyMat = new StandardMaterial('bodyMat', scene)
    bodyMat.emissiveColor  = new Color3(0.97, 0.97, 0.99)
    bodyMat.disableLighting = true
    body.material   = bodyMat
    body.isPickable = false

    // ── Group 0: face label planes ───────────────────────────────────────────
    FACES.forEach((f) => {
      const plane = MeshBuilder.CreatePlane(`face_${f.name}`, { size: 1.0 }, scene)
      plane.position.copyFrom(f.pos)
      plane.rotation.copyFrom(f.rot)
      const mat = new StandardMaterial(`fm_${f.name}`, scene)
      mat.emissiveTexture = createFaceTexture(f.label, scene)
      mat.disableLighting = true
      mat.backFaceCulling = true
      plane.material = mat
      plane.metadata = { viewName: f.name }
    })

    // ── Group 1: cube edges (depth preserved → no z-fight, back edges hidden) ─
    const ec = new Color4(0.30, 0.30, 0.38, 0.60)
    EDGE_PAIRS.forEach(([a, b], i) => {
      const ln = MeshBuilder.CreateLines(`e${i}`, {
        points: [CORNERS[a], CORNERS[b]], colors: [ec, ec],
      }, scene)
      ln.isPickable = false
      ln.renderingGroupId = 1
    })

    // ── Group 2: inner axis lines (always visible, low alpha = "inside" feel) ─
    AXES.forEach((ax) => {
      const c = Color3.FromHexString(ax.hex)
      // Blended 60% toward white so they read as "seen through white face"
      const w = 0.60
      const ri = c.r + (1 - c.r) * w, gi = c.g + (1 - c.g) * w, bi = c.b + (1 - c.b) * w
      const cInner0 = new Color4(ri, gi, bi, 0.25)
      const cInner1 = new Color4(ri, gi, bi, 0.50)
      const inner = MeshBuilder.CreateLines(`axIn_${ax.label}`, {
        points: [Vector3.Zero(), ax.dir.scale(0.5)],
        colors: [cInner0, cInner1],
      }, scene)
      inner.isPickable = false
      inner.renderingGroupId = 2
    })

    // ── Group 3: outer axis lines + badges (always on top, alpha driven per-frame) ─
    const badgeMats: { mat: StandardMaterial; dir: Vector3 }[] = []

    AXES.forEach((ax) => {
      const c = Color3.FromHexString(ax.hex)

      // Outer axis line: face surface → badge
      const cOut0 = new Color4(c.r, c.g, c.b, 0.70)
      const cOut1 = new Color4(c.r, c.g, c.b, 1.00)
      const outer = MeshBuilder.CreateLines(`axOut_${ax.label}`, {
        points: [ax.dir.scale(0.5), ax.dir.scale(BADGE_DIST)],
        colors: [cOut0, cOut1],
      }, scene)
      outer.isPickable = false
      outer.renderingGroupId = 3

      // Badge plane (billboarded)
      const badge = MeshBuilder.CreatePlane(`badge_${ax.label}`, { size: 0.26 }, scene)
      badge.position = ax.dir.scale(BADGE_DIST)
      badge.billboardMode = 7
      badge.isPickable = false
      badge.renderingGroupId = 3

      const mat = new StandardMaterial(`bm_${ax.label}`, scene)
      mat.diffuseTexture = createBadgeTexture(ax.label, ax.hex, scene)
      mat.useAlphaFromDiffuseTexture = true
      mat.emissiveColor   = new Color3(1, 1, 1)
      mat.specularColor   = new Color3(0, 0, 0)
      mat.backFaceCulling = false
      badge.material = mat

      badgeMats.push({ mat, dir: ax.dir.normalizeToNew() })
    })

    // ── Click: face planes → animate main camera ─────────────────────────────
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const name = info.pickInfo?.pickedMesh?.metadata?.viewName as ViewPreset | undefined
      if (name && VIEWS[name]) animateToView(name)
    })

    // ── Render loop ──────────────────────────────────────────────────────────
    engine.runRenderLoop(() => {
      const mc = mainCameraRef.current
      if (mc && cubeCamRef.current) {
        cubeCamRef.current.alpha = mc.alpha
        cubeCamRef.current.beta  = mc.beta
      }

      // Badge alpha: dot(badge_dir, cam_position) > 0 → badge faces camera → bright
      // cam.position is the vector from origin to camera = same side as "visible" badges
      if (cubeCamRef.current) {
        const camPos = cubeCamRef.current.position
        badgeMats.forEach(({ mat, dir }) => {
          const dot = Vector3.Dot(dir, camPos)
          mat.alpha = dot > 0 ? 1.0 : 0.25
        })
      }

      scene.render()
    })

    // ── Resize ───────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => {
      ro.disconnect()
      scene.dispose()
      engine.dispose()
      cubeCamRef.current = null
    }
  }, [])

  return (
    <div className="viewcube-widget">
      <div className="viewcube-canvas-wrap">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', outline: 'none', cursor: 'pointer' }} />
      </div>
    </div>
  )
}
