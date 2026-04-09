import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial,
  DynamicTexture, PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

// ─────────────────────────────────────────────────────────────────────────────
//  Data
// ─────────────────────────────────────────────────────────────────────────────

const FACES: { name: ViewPreset | 'BOTTOM'; label: string; normal: Vector3 }[] = [
  { name: 'TOP',    label: 'TOP',   normal: new Vector3( 0,  0,  1) },
  { name: 'BOTTOM', label: 'BTM',   normal: new Vector3( 0,  0, -1) },
  { name: 'FRONT',  label: 'FRONT', normal: new Vector3( 0, -1,  0) },
  { name: 'BACK',   label: 'BACK',  normal: new Vector3( 0,  1,  0) },
  { name: 'RIGHT',  label: 'RIGHT', normal: new Vector3( 1,  0,  0) },
  { name: 'LEFT',   label: 'LEFT',  normal: new Vector3(-1,  0,  0) },
]

const AXES: { label: string; dir: Vector3; color: string }[] = [
  { label: 'X', dir: new Vector3(1, 0, 0), color: '#e05555' },
  { label: 'Y', dir: new Vector3(0, 1, 0), color: '#4caf7d' },
  { label: 'Z', dir: new Vector3(0, 0, 1), color: '#4a90d9' },
]

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** White face tile with bold black label, no border */
function faceTex(label: string, scene: Scene): DynamicTexture {
  const t = new DynamicTexture(`ft_${label}`, { width: 256, height: 256 }, scene, false)
  const c = t.getContext() as unknown as CanvasRenderingContext2D
  c.fillStyle = '#f7f7fb'
  c.fillRect(0, 0, 256, 256)
  c.fillStyle = '#111827'
  c.font = `bold ${label.length >= 5 ? 40 : 52}px Arial`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, 128, 128)
  t.update()
  return t
}

/** Filled circle with white letter */
function badgeTex(label: string, color: string, scene: Scene): DynamicTexture {
  const t = new DynamicTexture(`bt_${label}`, { width: 128, height: 128 }, scene, false)
  const c = t.getContext() as unknown as CanvasRenderingContext2D
  c.clearRect(0, 0, 128, 128)
  c.beginPath(); c.arc(64, 64, 60, 0, Math.PI * 2)
  c.fillStyle = color; c.fill()
  c.fillStyle = '#ffffff'
  c.font = 'bold 70px Arial'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(label, 64, 66)
  t.update(); t.hasAlpha = true
  return t
}

/**
 * Given a face normal, return the Euler rotation for a CreatePlane so
 * the plane faces outward and the label text is right-side-up.
 */
function faceRotation(n: Vector3): Vector3 {
  // TOP
  if (n.z >  0.5) return new Vector3(0, 0, 0)
  // BOTTOM
  if (n.z < -0.5) return new Vector3(Math.PI, 0, 0)
  // FRONT  (+Y points away from camera in right-handed Z-up)
  if (n.y < -0.5) return new Vector3(Math.PI / 2, 0, 0)
  // BACK
  if (n.y >  0.5) return new Vector3(-Math.PI / 2, 0, Math.PI)
  // RIGHT
  if (n.x >  0.5) return new Vector3(0,  Math.PI / 2,  Math.PI / 2)
  // LEFT
  return                new Vector3(0, -Math.PI / 2, -Math.PI / 2)
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ViewCube() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const cubeCamRef    = useRef<ArcRotateCamera | null>(null)
  const mainCameraRef = useRef<ArcRotateCamera | null>(null)
  const mainCamera    = useViewerStore((s) => s.cameraRef)

  useEffect(() => { mainCameraRef.current = mainCamera }, [mainCamera])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Engine ──────────────────────────────────────────────────────────────
    let engine: Engine, scene: Scene
    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
      scene  = new Scene(engine)
    } catch { return }

    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    /*
     * Rendering groups strategy
     * ─────────────────────────
     * Group 0  Cube body + face tiles     normal depth, written to depth buffer
     * Group 1  Cube edges                 depth READ from group-0 (no z-fight),
     *                                     back edges naturally occluded
     * Group 2  Axis lines (inside+out)    depth CLEARED → always on top
     * Group 3  Axis badges                depth CLEARED → always on top
     *
     * setRenderingAutoClearDepthStencil(group, clearDepth)
     */
    scene.setRenderingAutoClearDepthStencil(1, false) // keep group-0 depth
    scene.setRenderingAutoClearDepthStencil(2, true)  // fresh → always visible
    scene.setRenderingAutoClearDepthStencil(3, true)  // fresh → always visible

    // ── Camera ──────────────────────────────────────────────────────────────
    const cam = new ArcRotateCamera('vc', -Math.PI / 4, Math.PI / 3, 3, Vector3.Zero(), scene)
    cam.upVector = new Vector3(0, 0, 1)
    cam.minZ = 0.01; cam.maxZ = 20
    cam.inputs.clear()
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    const s = 0.9
    cam.orthoLeft = -s; cam.orthoRight = s; cam.orthoTop = s; cam.orthoBottom = -s
    cubeCamRef.current = cam

    // ── Light ───────────────────────────────────────────────────────────────
    const light = new HemisphericLight('l', new Vector3(0, 0, 1), scene)
    light.intensity = 1; light.diffuse = new Color3(1, 1, 1)
    light.groundColor = new Color3(0.8, 0.8, 0.85)

    // ── Group 0: cube body (opaque white, fills interior) ───────────────────
    const body = MeshBuilder.CreateBox('body', { size: 1 }, scene)
    const bodyMat = new StandardMaterial('bodyMat', scene)
    bodyMat.emissiveColor = new Color3(0.97, 0.97, 0.99)
    bodyMat.disableLighting = true
    body.material = bodyMat
    body.isPickable = false
    body.renderingGroupId = 0

    // ── Group 0: face label tiles (1px outside body to win depth) ───────────
    FACES.forEach((f) => {
      const d = 0.501
      const plane = MeshBuilder.CreatePlane(`face_${f.name}`, { size: 1.0 }, scene)
      plane.position = f.normal.scale(d)
      plane.rotation = faceRotation(f.normal)
      const mat = new StandardMaterial(`fm_${f.name}`, scene)
      mat.emissiveTexture = faceTex(f.label, scene)
      mat.disableLighting = true
      mat.backFaceCulling = true
      plane.material = mat
      plane.metadata = { viewName: f.name }
      plane.renderingGroupId = 0
    })

    // ── Group 1: cube edges ─────────────────────────────────────────────────
    // Vertices scaled 1.002× so they clear the body surface by a hair
    const r = 0.502
    const verts: Vector3[] = [
      new Vector3(-r,-r,-r), new Vector3( r,-r,-r),
      new Vector3( r, r,-r), new Vector3(-r, r,-r),
      new Vector3(-r,-r, r), new Vector3( r,-r, r),
      new Vector3( r, r, r), new Vector3(-r, r, r),
    ]
    const pairs: [number,number][] = [
      [0,1],[1,2],[2,3],[3,0],
      [4,5],[5,6],[6,7],[7,4],
      [0,4],[1,5],[2,6],[3,7],
    ]
    const ec = new Color4(0.35, 0.35, 0.42, 0.55)
    pairs.forEach(([a, b], i) => {
      const ln = MeshBuilder.CreateLines(`edge_${i}`, {
        points: [verts[a], verts[b]], colors: [ec, ec],
      }, scene)
      ln.isPickable = false
      ln.renderingGroupId = 1
    })

    // ── Group 2: axis lines ─────────────────────────────────────────────────
    AXES.forEach((ax) => {
      const c = Color3.FromHexString(ax.color)
      // Inside segment: washed toward white to look "seen through face"
      const w = 0.55
      const ic = new Color4(c.r+(1-c.r)*w, c.g+(1-c.g)*w, c.b+(1-c.b)*w, 1)
      const innerLine = MeshBuilder.CreateLines(`axIn_${ax.label}`, {
        points: [Vector3.Zero(), ax.dir.scale(0.5)],
        colors: [new Color4(ic.r, ic.g, ic.b, 0.3), new Color4(ic.r, ic.g, ic.b, 0.7)],
      }, scene)
      innerLine.isPickable = false
      innerLine.renderingGroupId = 2

      // Outside segment: full saturation
      const outerLine = MeshBuilder.CreateLines(`axOut_${ax.label}`, {
        points: [ax.dir.scale(0.5), ax.dir.scale(0.72)],
        colors: [new Color4(c.r, c.g, c.b, 0.7), new Color4(c.r, c.g, c.b, 1.0)],
      }, scene)
      outerLine.isPickable = false
      outerLine.renderingGroupId = 2
    })

    // ── Group 3: axis badges ────────────────────────────────────────────────
    // Alpha updated per-frame: front-facing = 1.0, back-facing = 0.22
    const badges: { mat: StandardMaterial; dir: Vector3 }[] = []
    AXES.forEach((ax) => {
      const badge = MeshBuilder.CreatePlane(`badge_${ax.label}`, { size: 0.25 }, scene)
      badge.position = ax.dir.scale(0.72)
      badge.billboardMode = 7 // BILLBOARDMODE_ALL
      badge.isPickable = false
      badge.renderingGroupId = 3

      const mat = new StandardMaterial(`bm_${ax.label}`, scene)
      mat.diffuseTexture = badgeTex(ax.label, ax.color, scene)
      mat.useAlphaFromDiffuseTexture = true
      mat.emissiveColor = new Color3(1, 1, 1)
      mat.specularColor = new Color3(0, 0, 0)
      mat.backFaceCulling = false
      badge.material = mat
      badges.push({ mat, dir: ax.dir.clone() })
    })

    // ── Click → camera preset ────────────────────────────────────────────────
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const name = info.pickInfo?.pickedMesh?.metadata?.viewName as ViewPreset | undefined
      if (name && VIEWS[name]) animateToView(name)
    })

    // ── Render loop ──────────────────────────────────────────────────────────
    engine.runRenderLoop(() => {
      // Mirror main camera orientation
      const mc = mainCameraRef.current
      if (mc && cubeCamRef.current) {
        cubeCamRef.current.alpha = mc.alpha
        cubeCamRef.current.beta  = mc.beta
      }
      // Badge alpha: positive dot(badge_dir, cam_position) → badge on camera side
      if (cubeCamRef.current) {
        const camPos = cubeCamRef.current.position
        badges.forEach(({ mat, dir }) => {
          mat.alpha = Vector3.Dot(dir, camPos) > 0 ? 1.0 : 0.22
        })
      }
      scene.render()
    })

    // ── Cleanup ──────────────────────────────────────────────────────────────
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
