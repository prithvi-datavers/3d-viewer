import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture,
  MultiMaterial, SubMesh, PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

// BabylonJS box face order: right(+X), left(-X), top(+Z), bottom(-Z), front(-Y), back(+Y)
const BOX_FACE_LABELS = ['RIGHT', 'LEFT', 'TOP', 'BTM', 'FRONT', 'BACK']

// Axis badge tips extend just beyond cube face (0.72 units)
const AXIS_DEFS = [
  { label: 'X', pos: new Vector3(0.72, 0, 0),  hex: '#e53e3e' },
  { label: 'Y', pos: new Vector3(0, 0.72, 0),  hex: '#38a169' },
  { label: 'Z', pos: new Vector3(0, 0, 0.72),  hex: '#3182ce' },
]

// Axis lines: origin → just inside each face (0.46 units)
const AXIS_LINE_DEFS = [
  { label: 'X', tip: new Vector3(0.46, 0, 0),  hex: '#e53e3e' },
  { label: 'Y', tip: new Vector3(0, 0.46, 0),  hex: '#38a169' },
  { label: 'Z', tip: new Vector3(0, 0, 0.46),  hex: '#3182ce' },
]

function makeFaceTex(label: string, scene: Scene): DynamicTexture {
  const tex = new DynamicTexture(`faceTex_${label}`, { width: 256, height: 256 }, scene, false)
  const ctx = tex.getContext() as unknown as CanvasRenderingContext2D
  ctx.clearRect(0, 0, 256, 256)

  // Solid white face
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 256, 256)

  // Subtle border
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 5
  ctx.strokeRect(2.5, 2.5, 251, 251)

  // Bold black label
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

  // Filled colored circle
  ctx.beginPath()
  ctx.arc(64, 64, 60, 0, Math.PI * 2)
  ctx.fillStyle = hex
  ctx.fill()

  // White letter
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 70px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 64, 66) // +2px optical center
  tex.update()
  tex.hasAlpha = true
  return tex
}

export default function ViewCube() {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const cubeCamRef    = useRef<ArcRotateCamera | null>(null)
  const mainCameraRef = useRef<ArcRotateCamera | null>(null)
  const mainCamera    = useViewerStore((s) => s.cameraRef)

  // Keep mainCameraRef current so the render loop always reads the latest value
  useEffect(() => { mainCameraRef.current = mainCamera }, [mainCamera])

  // Initialize engine + scene once on mount
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let engine: Engine
    let scene: Scene
    try {
      engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
      scene  = new Scene(engine)
    } catch {
      return // WebGL not available — hide cube gracefully
    }

    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Orthographic camera
    const camera = new ArcRotateCamera('cubeCamera', -Math.PI / 4, Math.PI / 3, 2.8, Vector3.Zero(), scene)
    camera.upVector = new Vector3(0, 0, 1)
    camera.minZ = 0.01
    camera.maxZ = 20
    camera.inputs.clear()
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    const oh = 0.95
    camera.orthoLeft = -oh; camera.orthoRight = oh
    camera.orthoTop  =  oh; camera.orthoBottom = -oh
    cubeCamRef.current = camera

    // Lights
    const hemi = new HemisphericLight('h', new Vector3(0, 0, 1), scene)
    hemi.intensity = 0.9
    hemi.diffuse   = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.6, 0.6, 0.65)
    const dir = new DirectionalLight('d', new Vector3(-1, -0.5, -1).normalize(), scene)
    dir.intensity = 0.4

    // ── Cube with per-face label textures via MultiMaterial ──────────────
    const box = MeshBuilder.CreateBox('cube', {
      size: 1,
      // faceUV not needed — we use submeshes + multi-material
    }, scene)

    // Enable 6-submesh multi-material support
    box.subMeshes = []
    const verticesCount = box.getTotalVertices()
    // BabylonJS box has 6 faces × 2 triangles × 3 indices = 36 indices, 6 per face
    for (let i = 0; i < 6; i++) {
      box.subMeshes.push(new SubMesh(i, 0, verticesCount, i * 6, 6, box))
    }

    const multiMat = new MultiMaterial('cubeMat', scene)
    BOX_FACE_LABELS.forEach((label) => {
      const mat = new StandardMaterial(`faceMat_${label}`, scene)
      mat.diffuseTexture  = makeFaceTex(label, scene)
      mat.specularColor   = new Color3(0.1, 0.1, 0.1)
      mat.specularPower   = 32
      mat.emissiveColor   = new Color3(0.05, 0.05, 0.05)
      multiMat.subMaterials.push(mat)
    })
    box.material = multiMat

    // Click on face → animate main camera
    box.metadata = null
    BOX_FACE_LABELS.forEach((label, i) => {
      if (!box.subMeshes[i]) return
      // Store label in subMesh metadata via a side-channel on the box
    })

    // Dark thin edges
    box.enableEdgesRendering()
    box.edgesWidth = 3.5
    box.edgesColor = new Color4(0.08, 0.08, 0.12, 1)

    // ── Axis lines ───────────────────────────────────────────────────────
    AXIS_LINE_DEFS.forEach((ax) => {
      const c  = Color3.FromHexString(ax.hex)
      const c4 = new Color4(c.r, c.g, c.b, 1)
      const line = MeshBuilder.CreateLines(`axLine_${ax.label}`, {
        points: [Vector3.Zero(), ax.tip],
        colors: [new Color4(c.r, c.g, c.b, 0.3), c4],
      }, scene)
      line.isPickable = false
    })

    // ── Axis badge planes (billboarded, colored circle + white letter) ───
    AXIS_DEFS.forEach((ax) => {
      const plane = MeshBuilder.CreatePlane(`badge_${ax.label}`, { size: 0.26 }, scene)
      plane.position   = ax.pos.clone()
      plane.billboardMode = 7 // BILLBOARDMODE_ALL

      const mat = new StandardMaterial(`badgeMat_${ax.label}`, scene)
      mat.diffuseTexture = makeBadgeTex(ax.label, ax.hex, scene)
      mat.useAlphaFromDiffuseTexture = true
      mat.emissiveColor   = new Color3(1, 1, 1)
      mat.specularColor   = new Color3(0, 0, 0)
      mat.backFaceCulling = false
      plane.material   = mat
      plane.isPickable = false
    })

    // ── Click handling (pick by submesh) ─────────────────────────────────
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const pick = info.pickInfo
      if (!pick?.hit || pick.pickedMesh?.name !== 'cube') return
      const faceIdx = pick.subMeshId ?? -1
      const label = BOX_FACE_LABELS[faceIdx] as ViewPreset | undefined
      if (label && VIEWS[label]) animateToView(label)
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
