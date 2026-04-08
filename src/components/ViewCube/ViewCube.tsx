import { useRef, useEffect } from 'react'
import {
  Engine, Scene, ArcRotateCamera, HemisphericLight, DirectionalLight,
  Vector3, Color3, Color4, MeshBuilder, StandardMaterial, DynamicTexture,
  PointerEventTypes, Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

const FACE_DEFS = [
  { name: 'FRONT',  pos: [0, -0.501, 0]  as [number,number,number], rot: [ Math.PI/2, 0, 0]       as [number,number,number] },
  { name: 'BACK',   pos: [0,  0.501, 0]  as [number,number,number], rot: [-Math.PI/2, 0, Math.PI] as [number,number,number] },
  { name: 'RIGHT',  pos: [0.501,  0, 0]  as [number,number,number], rot: [0, 0, -Math.PI/2]       as [number,number,number] },
  { name: 'LEFT',   pos: [-0.501, 0, 0]  as [number,number,number], rot: [0, 0,  Math.PI/2]       as [number,number,number] },
  { name: 'TOP',    pos: [0, 0,  0.501]  as [number,number,number], rot: [0, 0, 0]                as [number,number,number] },
  { name: 'BOTTOM', pos: [0, 0, -0.501]  as [number,number,number], rot: [Math.PI, 0, 0]          as [number,number,number] },
]

const FACE_LABELS: Record<string, string> = {
  FRONT: 'FRONT', BACK: 'BACK', RIGHT: 'RIGHT', LEFT: 'LEFT', TOP: 'TOP', BOTTOM: 'BTM',
}

// Axis badge definitions — tips extend just beyond cube face (0.72 units)
const AXIS_DEFS = [
  { label: 'X', dir: new Vector3(0.72, 0, 0),  color: '#e53e3e' },
  { label: 'Y', dir: new Vector3(0, 0.72, 0),  color: '#38a169' },
  { label: 'Z', dir: new Vector3(0, 0, 0.72),  color: '#3182ce' },
]

export default function ViewCube() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const cubeCamRef = useRef<ArcRotateCamera | null>(null)
  const mainCamera = useViewerStore((s) => s.cameraRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
    const scene  = new Scene(engine)
    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Orthographic camera — matches XViewr isometric view
    const camera = new ArcRotateCamera('cubeCamera', -Math.PI / 4, Math.PI / 3, 2.8, Vector3.Zero(), scene)
    camera.upVector = new Vector3(0, 0, 1)
    camera.minZ = 0.01
    camera.maxZ = 20
    camera.inputs.clear()
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    // Slightly zoomed out to give room for axis badge labels outside the cube
    const oh = 0.95
    camera.orthoLeft = -oh; camera.orthoRight = oh
    camera.orthoTop  =  oh; camera.orthoBottom = -oh
    cubeCamRef.current = camera

    // Lights
    const hemi = new HemisphericLight('h', new Vector3(0.3, 0.3, 1), scene)
    hemi.intensity = 1.0
    hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.65, 0.65, 0.7)
    const dir = new DirectionalLight('d', new Vector3(-1, -0.5, -1).normalize(), scene)
    dir.intensity = 0.3

    // Cube body — very light, near white, slight transparency
    const box = MeshBuilder.CreateBox('cubeBody', { size: 1 }, scene)
    const boxMat = new StandardMaterial('cubeBodyMat', scene)
    boxMat.diffuseColor  = new Color3(0.98, 0.98, 1.0)
    boxMat.specularColor = new Color3(0.3, 0.3, 0.4)
    boxMat.specularPower = 48
    boxMat.alpha = 0.30
    box.material = boxMat
    box.isPickable = false

    // Dark thin edges on the cube body
    box.enableEdgesRendering()
    box.edgesWidth = 4
    box.edgesColor = new Color4(0.1, 0.1, 0.15, 0.9)

    // Face planes — white, thin border, clean black label
    FACE_DEFS.forEach((def) => {
      const plane = MeshBuilder.CreatePlane(`face_${def.name}`, { size: 1.0 }, scene)
      plane.position = new Vector3(...def.pos)
      plane.rotation = new Vector3(...def.rot)

      const tex = new DynamicTexture(`tex_${def.name}`, { width: 256, height: 256 }, scene, false)
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D

      // White face
      ctx.clearRect(0, 0, 256, 256)
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.fillRect(0, 0, 256, 256)

      // Thin dark border
      ctx.strokeStyle = 'rgba(15,15,25,0.55)'
      ctx.lineWidth = 6
      ctx.strokeRect(3, 3, 250, 250)

      // Black label — sized to fit
      const label = FACE_LABELS[def.name]
      const fontSize = label.length >= 5 ? 36 : 44
      ctx.fillStyle = 'rgba(10,10,20,0.88)'
      ctx.font = `bold ${fontSize}px -apple-system, Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 128, 128)
      tex.update()

      const mat = new StandardMaterial(`mat_${def.name}`, scene)
      mat.diffuseTexture = tex
      mat.diffuseTexture.hasAlpha = true
      mat.useAlphaFromDiffuseTexture = true
      mat.specularColor = new Color3(0, 0, 0)
      mat.emissiveColor = new Color3(0.04, 0.04, 0.04)
      mat.backFaceCulling = true
      mat.alpha = 0.92
      plane.material = mat
      plane.metadata = { viewName: def.name }
    })

    // Axis lines from origin to just inside the face (0.48 units)
    const axisInner = 0.48
    const axisDefs2 = [
      { label: 'X', inner: new Vector3(axisInner, 0, 0), color: '#e53e3e' },
      { label: 'Y', inner: new Vector3(0, axisInner, 0), color: '#38a169' },
      { label: 'Z', inner: new Vector3(0, 0, axisInner), color: '#3182ce' },
    ]
    axisDefs2.forEach((ax) => {
      const c = Color3.FromHexString(ax.color)
      const c4 = new Color4(c.r, c.g, c.b, 0.85)
      const line = MeshBuilder.CreateLines(`axisLine_${ax.label}`, {
        points: [Vector3.Zero(), ax.inner],
        colors: [new Color4(c.r, c.g, c.b, 0.4), c4],
      }, scene)
      line.isPickable = false
    })

    // Axis badge spheres — large colored circles with white letter, outside cube face
    AXIS_DEFS.forEach((ax) => {
      const c = Color3.FromHexString(ax.color)

      // Sphere badge
      const badge = MeshBuilder.CreateSphere(`badge_${ax.label}`, { diameter: 0.22, segments: 16 }, scene)
      badge.position = ax.dir.clone()
      const badgeMat = new StandardMaterial(`badgeMat_${ax.label}`, scene)
      badgeMat.diffuseColor  = c
      badgeMat.emissiveColor = c.scale(0.35)
      badgeMat.specularColor = new Color3(0.3, 0.3, 0.3)
      badge.material = badgeMat
      badge.isPickable = false

      // Label plane on the badge (billboarded, white letter)
      const lPlane = MeshBuilder.CreatePlane(`badgeLabel_${ax.label}`, { size: 0.22 }, scene)
      lPlane.position = ax.dir.clone()
      lPlane.billboardMode = 7

      const lTex = new DynamicTexture(`badgeLabelTex_${ax.label}`, { width: 128, height: 128 }, scene, false)
      const lCtx = lTex.getContext() as unknown as CanvasRenderingContext2D
      lCtx.clearRect(0, 0, 128, 128)
      lCtx.fillStyle = '#ffffff'
      lCtx.font = 'bold 72px Arial'
      lCtx.textAlign = 'center'
      lCtx.textBaseline = 'middle'
      lCtx.fillText(ax.label, 64, 64)
      lTex.update()
      lTex.hasAlpha = true

      const lMat = new StandardMaterial(`badgeLabelMat_${ax.label}`, scene)
      lMat.diffuseTexture = lTex
      lMat.emissiveColor = new Color3(1, 1, 1)
      lMat.useAlphaFromDiffuseTexture = true
      lMat.backFaceCulling = false
      lPlane.material = lMat
      lPlane.isPickable = false
    })

    // Click → animate main camera
    scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const viewName = info.pickInfo?.pickedMesh?.metadata?.viewName as ViewPreset | undefined
      if (viewName && VIEWS[viewName]) animateToView(viewName)
    })

    engine.runRenderLoop(() => {
      if (mainCamera && cubeCamRef.current) {
        cubeCamRef.current.alpha = mainCamera.alpha
        cubeCamRef.current.beta  = mainCamera.beta
      }
      scene.render()
    })

    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => { ro.disconnect(); scene.dispose(); engine.dispose() }
  }, [mainCamera])

  return (
    <div className="viewcube-widget">
      <div className="viewcube-canvas-wrap">
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', outline: 'none', cursor: 'pointer' }} />
      </div>
    </div>
  )
}
