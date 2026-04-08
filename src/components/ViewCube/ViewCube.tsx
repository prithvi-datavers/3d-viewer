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
  { name: 'FRONT',  pos: [0, -0.501, 0]  as [number,number,number], rot: [ Math.PI/2, 0, 0]          as [number,number,number] },
  { name: 'BACK',   pos: [0,  0.501, 0]  as [number,number,number], rot: [-Math.PI/2, 0, Math.PI]    as [number,number,number] },
  { name: 'RIGHT',  pos: [0.501,  0, 0]  as [number,number,number], rot: [0, 0, -Math.PI/2]          as [number,number,number] },
  { name: 'LEFT',   pos: [-0.501, 0, 0]  as [number,number,number], rot: [0, 0,  Math.PI/2]          as [number,number,number] },
  { name: 'TOP',    pos: [0, 0,  0.501]  as [number,number,number], rot: [0, 0, 0]                   as [number,number,number] },
  { name: 'BOTTOM', pos: [0, 0, -0.501]  as [number,number,number], rot: [Math.PI, 0, 0]             as [number,number,number] },
]

// Label for each face — short so they fit clearly
const FACE_LABELS: Record<string, string> = {
  FRONT: 'FRONT', BACK: 'BACK', RIGHT: 'RIGHT', LEFT: 'LEFT', TOP: 'TOP', BOTTOM: 'BTM',
}

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

    // Orthographic camera
    const camera = new ArcRotateCamera('cubeCamera', -Math.PI / 4, Math.PI / 3, 2.8, Vector3.Zero(), scene)
    camera.upVector = new Vector3(0, 0, 1)
    camera.minZ = 0.01
    camera.maxZ = 20
    camera.inputs.clear()
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    const oh = 0.78
    camera.orthoLeft = -oh; camera.orthoRight = oh
    camera.orthoTop  =  oh; camera.orthoBottom = -oh
    cubeCamRef.current = camera

    // Lights
    const hemi = new HemisphericLight('h', new Vector3(0.3, 0.3, 1), scene)
    hemi.intensity = 0.9
    hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.7, 0.7, 0.72)
    const dir = new DirectionalLight('d', new Vector3(-1, -0.5, -1).normalize(), scene)
    dir.intensity = 0.35

    // Glass cube body — very light, slightly blue-tinted
    const box = MeshBuilder.CreateBox('cubeBody', { size: 1 }, scene)
    const boxMat = new StandardMaterial('cubeBodyMat', scene)
    boxMat.diffuseColor  = new Color3(0.97, 0.97, 1.0)
    boxMat.specularColor = new Color3(0.4, 0.4, 0.5)
    boxMat.specularPower = 64
    boxMat.alpha = 0.18   // very transparent — glass effect
    box.material = boxMat
    box.isPickable = false

    // Dark edges — XViewr style
    box.enableEdgesRendering()
    box.edgesWidth = 5
    box.edgesColor = new Color4(0.08, 0.08, 0.12, 1)

    // Face planes — white with thin black border + black label
    FACE_DEFS.forEach((def) => {
      const plane = MeshBuilder.CreatePlane(`face_${def.name}`, { size: 1.0 }, scene)
      plane.position = new Vector3(...def.pos)
      plane.rotation = new Vector3(...def.rot)

      const tex = new DynamicTexture(`tex_${def.name}`, { width: 256, height: 256 }, scene, false)
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D

      // White face fill (glass-like — mostly transparent, but face areas white)
      ctx.clearRect(0, 0, 256, 256)
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.fillRect(0, 0, 256, 256)

      // Thin dark border
      ctx.strokeStyle = 'rgba(20,20,35,0.75)'
      ctx.lineWidth = 8
      ctx.strokeRect(4, 4, 248, 248)

      // Black label — bold, readable
      const label = FACE_LABELS[def.name]
      const fontSize = label.length > 4 ? 38 : 46
      ctx.fillStyle = 'rgba(15,15,25,0.90)'
      ctx.font = `bold ${fontSize}px Arial`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 128, 128)
      tex.update()

      const mat = new StandardMaterial(`mat_${def.name}`, scene)
      mat.diffuseTexture = tex
      mat.diffuseTexture.hasAlpha = true
      mat.useAlphaFromDiffuseTexture = true
      mat.specularColor = new Color3(0, 0, 0)
      mat.emissiveColor = new Color3(0.05, 0.05, 0.05)
      mat.backFaceCulling = true
      mat.alpha = 0.88
      plane.material = mat
      plane.metadata = { viewName: def.name }
    })

    // X/Y/Z axis lines — short, inside the cube (±0.45 units), colored XViewr style
    const axisLen = 0.42
    const axesDef = [
      { dir: new Vector3(axisLen, 0, 0), color: '#e53e3e', label: 'X' },  // red
      { dir: new Vector3(0, axisLen, 0), color: '#38a169', label: 'Y' },  // green
      { dir: new Vector3(0, 0, axisLen), color: '#3182ce', label: 'Z' },  // blue
    ]
    const origin = Vector3.Zero()
    axesDef.forEach((ax) => {
      const c = Color3.FromHexString(ax.color)
      const c4 = new Color4(c.r, c.g, c.b, 1)
      const line = MeshBuilder.CreateLines(`axis_${ax.label}`, {
        points: [origin.clone(), ax.dir.clone()],
        colors: [c4, c4],
      }, scene)
      line.isPickable = false

      // Small sphere tip
      const tip = MeshBuilder.CreateSphere(`tip_${ax.label}`, { diameter: 0.07 }, scene)
      tip.position = ax.dir.clone()
      const tipMat = new StandardMaterial(`tipMat_${ax.label}`, scene)
      tipMat.diffuseColor  = c
      tipMat.emissiveColor = c.scale(0.6)
      tip.material = tipMat
      tip.isPickable = false
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
