/**
 * ViewCube — XViewr-style orientation widget
 *
 * Rendering groups
 *   0  cube body (opaque white solid) + face label planes
 *   1  cube edges  — inherits group-0 depth (no z-fight, back edges hidden)
 *   2  axis lines  — depth cleared (always visible through cube body)
 *   3  axis badges — depth cleared (always visible); alpha driven per-frame
 *
 * Coordinate system: right-handed, Z-up (matches main scene)
 */

import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight,
  Vector3, Color3, Color4,
  MeshBuilder, StandardMaterial, DynamicTexture,
  PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

// ── Static data ───────────────────────────────────────────────────────────────

/** Face normals in world space (Z-up right-handed) */
const FACE_DATA = [
  { view: 'TOP'    as ViewPreset, label: 'TOP',   nx:  0, ny:  0, nz:  1 },
  { view: 'BOTTOM' as ViewPreset, label: 'BTM',   nx:  0, ny:  0, nz: -1 },
  { view: 'FRONT'  as ViewPreset, label: 'FRONT', nx:  0, ny: -1, nz:  0 },
  { view: 'BACK'   as ViewPreset, label: 'BACK',  nx:  0, ny:  1, nz:  0 },
  { view: 'RIGHT'  as ViewPreset, label: 'RIGHT', nx:  1, ny:  0, nz:  0 },
  { view: 'LEFT'   as ViewPreset, label: 'LEFT',  nx: -1, ny:  0, nz:  0 },
]

const AXIS_DATA = [
  { label: 'X', nx: 1, ny: 0, nz: 0, hex: '#e05252' },
  { label: 'Y', nx: 0, ny: 1, nz: 0, hex: '#52b052' },
  { label: 'Z', nx: 0, ny: 0, nz: 1, hex: '#4a90d9' },
]

/** 12 cube edge vertex-index pairs (cube corners at ±0.5) */
const C = 0.502  // slightly outside 0.5 so edges win depth over face surfaces
const CUBE_VERTS = [
  [-C,-C,-C],[C,-C,-C],[C,C,-C],[-C,C,-C],
  [-C,-C, C],[C,-C, C],[C,C, C],[-C,C, C],
].map(([x,y,z]) => new Vector3(x,y,z))
const EDGE_PAIRS: [number,number][] = [
  [0,1],[1,2],[2,3],[3,0],
  [4,5],[5,6],[6,7],[7,4],
  [0,4],[1,5],[2,6],[3,7],
]

// ── Rotation for face planes ───────────────────────────────────────────────────
// A Babylon CreatePlane lies in the local XY plane; its normal points +Z local.
// We need that normal to point along the face's outward world normal.
// Right-handed Z-up coordinate system.
function faceEuler(nx: number, ny: number, nz: number): Vector3 {
  if (nz >  0.5) return new Vector3(0, 0, 0)               // TOP    +Z
  if (nz < -0.5) return new Vector3(Math.PI, 0, 0)          // BOTTOM −Z
  if (ny < -0.5) return new Vector3(Math.PI / 2, 0, 0)      // FRONT  −Y
  if (ny >  0.5) return new Vector3(-Math.PI / 2, 0, Math.PI) // BACK  +Y
  if (nx >  0.5) return new Vector3(0,  Math.PI / 2,  Math.PI / 2) // RIGHT +X
  return               new Vector3(0, -Math.PI / 2, -Math.PI / 2)  // LEFT  −X
}

// ── Texture helpers ────────────────────────────────────────────────────────────

function makeFaceTex(label: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`ft_${label}`, { width: 256, height: 256 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  // White background
  ctx.fillStyle = '#f8f8fc'
  ctx.fillRect(0, 0, 256, 256)
  // Bold black label
  ctx.fillStyle = '#1a1a2e'
  ctx.font = `bold ${label.length >= 5 ? 40 : 52}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 128, 128)
  tex.update()
  return tex
}

function makeBadgeTex(label: string, hex: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`bt_${label}`, { width: 128, height: 128 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 128, 128)
  // Filled circle
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fillStyle = hex
  ctx.fill()
  // White letter
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 54px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 64, 65)
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

  // Keep latest main-camera pointer accessible inside the render loop
  useEffect(() => { mainCameraRef.current = mainCamera }, [mainCamera])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Engine
    let engine: Engine, scene: Scene
    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
      scene  = new Scene(engine)
    } catch { return }

    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Rendering group depth control
    scene.setRenderingAutoClearDepthStencil(1, false) // edges: keep group-0 depth
    scene.setRenderingAutoClearDepthStencil(2, true)  // axis lines: always on top
    scene.setRenderingAutoClearDepthStencil(3, true)  // badges:     always on top

    // ── Camera ────────────────────────────────────────────────────────────────
    const cam = new ArcRotateCamera('vc', -Math.PI / 4, Math.PI / 3, 3, Vector3.Zero(), scene)
    cam.upVector = new Vector3(0, 0, 1)
    cam.minZ = 0.01; cam.maxZ = 20
    cam.inputs.clear()
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA
    const ORT = 0.92
    cam.orthoLeft = -ORT; cam.orthoRight = ORT
    cam.orthoTop  =  ORT; cam.orthoBottom = -ORT
    cubeCamRef.current = cam

    // ── Light ─────────────────────────────────────────────────────────────────
    const hemi = new HemisphericLight('h', new Vector3(0, 0, 1), scene)
    hemi.intensity = 1; hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.8, 0.8, 0.85)

    // ── Group 0: solid cube body ───────────────────────────────────────────────
    // Fills the interior so back face-planes are never visible through gaps.
    const body = MeshBuilder.CreateBox('body', { size: 1 }, scene)
    const bodyMat = new StandardMaterial('bm', scene)
    bodyMat.emissiveColor   = new Color3(0.97, 0.97, 0.99)
    bodyMat.disableLighting = true
    body.material   = bodyMat
    body.isPickable = false
    body.renderingGroupId = 0

    // ── Group 0: face label planes ────────────────────────────────────────────
    // Placed at ±0.501 (one thousandth outside body) to win depth test cleanly.
    // backFaceCulling=true ensures only the outward face is visible.
    FACE_DATA.forEach((f) => {
      const plane = MeshBuilder.CreatePlane(`fp_${f.view}`, { size: 1.0 }, scene)
      plane.position = new Vector3(f.nx, f.ny, f.nz).scaleInPlace(0.501)
      plane.rotation = faceEuler(f.nx, f.ny, f.nz)
      const mat = new StandardMaterial(`fm_${f.view}`, scene)
      mat.emissiveTexture  = makeFaceTex(f.label, scene)
      mat.emissiveColor    = new Color3(1, 1, 1)  // pass texture through unchanged
      mat.disableLighting  = true
      mat.backFaceCulling  = true
      plane.material = mat
      plane.metadata = { viewName: f.view }
      plane.renderingGroupId = 0
    })

    // ── Group 1: cube edges ───────────────────────────────────────────────────
    // Vertices scaled to 0.502 so they sit just outside the body surface.
    // Rendering group 1 inherits depth from group 0:
    //   → no z-fighting with face planes
    //   → back-side edges naturally hidden by body depth buffer
    const edgeColor = new Color4(0.25, 0.25, 0.30, 0.55)
    EDGE_PAIRS.forEach(([a, b], i) => {
      const ln = MeshBuilder.CreateLines(`e${i}`, {
        points: [CUBE_VERTS[a], CUBE_VERTS[b]],
        colors: [edgeColor, edgeColor],
      }, scene)
      ln.isPickable = false
      ln.renderingGroupId = 1
    })

    // ── Group 2: axis lines ───────────────────────────────────────────────────
    // Depth cleared → always visible through the opaque cube body.
    // Inner segment: color washed toward white — simulates "seen through face".
    // Outer segment: full saturation — clearly outside the cube.
    AXIS_DATA.forEach((ax) => {
      const c   = Color3.FromHexString(ax.hex)
      const dir = new Vector3(ax.nx, ax.ny, ax.nz)

      // Inner: origin → cube face (0.5), washed 55% toward white
      const w  = 0.55
      const ir = c.r + (1 - c.r) * w
      const ig = c.g + (1 - c.g) * w
      const ib = c.b + (1 - c.b) * w
      const inner = MeshBuilder.CreateLines(`axI_${ax.label}`, {
        points: [Vector3.Zero(), dir.scale(0.50)],
        colors: [
          new Color4(ir, ig, ib, 0.25),
          new Color4(ir, ig, ib, 0.60),
        ],
      }, scene)
      inner.isPickable = false
      inner.renderingGroupId = 2

      // Outer: cube face → badge (0.5 → 0.72), full color
      const outer = MeshBuilder.CreateLines(`axO_${ax.label}`, {
        points: [dir.scale(0.50), dir.scale(0.72)],
        colors: [
          new Color4(c.r, c.g, c.b, 0.70),
          new Color4(c.r, c.g, c.b, 1.00),
        ],
      }, scene)
      outer.isPickable = false
      outer.renderingGroupId = 2
    })

    // ── Group 3: axis badges ──────────────────────────────────────────────────
    // Billboarded planes — always face camera.
    // Depth cleared → always visible.
    // Alpha updated each frame: 1.0 if on camera side, 0.22 if behind cube.
    const badgeRefs: { mat: StandardMaterial; dir: Vector3 }[] = []

    AXIS_DATA.forEach((ax) => {
      const dir   = new Vector3(ax.nx, ax.ny, ax.nz)
      const badge = MeshBuilder.CreatePlane(`bd_${ax.label}`, { size: 0.32 }, scene)
      badge.position      = dir.scale(0.72)
      badge.billboardMode = 7  // BILLBOARDMODE_ALL
      badge.isPickable    = false
      badge.renderingGroupId = 3

      const mat = new StandardMaterial(`bm_${ax.label}`, scene)
      mat.diffuseTexture = makeBadgeTex(ax.label, ax.hex, scene)
      mat.useAlphaFromDiffuseTexture = true
      mat.emissiveColor   = new Color3(1, 1, 1)
      mat.specularColor   = new Color3(0, 0, 0)
      mat.backFaceCulling = false
      badge.material = mat

      badgeRefs.push({ mat, dir: dir.clone() })
    })

    // ── Click: face planes → animate main camera ──────────────────────────────
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const view = info.pickInfo?.pickedMesh?.metadata?.viewName as ViewPreset | undefined
      if (view && VIEWS[view]) animateToView(view)
    })

    // ── Render loop ───────────────────────────────────────────────────────────
    engine.runRenderLoop(() => {
      // Sync cube camera angles to main camera
      const mc = mainCameraRef.current
      if (mc && cubeCamRef.current) {
        cubeCamRef.current.alpha = mc.alpha
        cubeCamRef.current.beta  = mc.beta
      }

      // Badge alpha: dot(badge_dir, cam_position_from_origin)
      // Positive dot → badge is on the same side as the camera → full brightness
      // Negative dot → badge is behind the cube → dim
      if (cubeCamRef.current) {
        const cp = cubeCamRef.current.position
        badgeRefs.forEach(({ mat, dir }) => {
          mat.alpha = Vector3.Dot(dir, cp) > 0 ? 1.0 : 0.22
        })
      }

      scene.render()
    })

    // ── Resize ────────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => {
      ro.disconnect()
      scene.dispose()
      engine.dispose()
      cubeCamRef.current = null
    }
  }, []) // runs once — mainCameraRef kept current via separate effect

  return (
    <div className="viewcube-widget">
      <div className="viewcube-canvas-wrap">
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', outline: 'none', cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}
