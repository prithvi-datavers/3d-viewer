import { useRef, useEffect } from 'react'
import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  DynamicTexture,
  PointerEventTypes,
  Camera,
} from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { animateToView, VIEWS } from '../../lib/babylon/CameraManager'
import type { ViewPreset } from '../../types/viewer'

const FACE_DEFS = [
  { name: 'FRONT',  pos: [0, -0.501, 0] as [number,number,number], rot: [Math.PI / 2, 0, 0] as [number,number,number],        color: '#6366f1', text: 'FRONT'  },
  { name: 'BACK',   pos: [0, 0.501, 0]  as [number,number,number], rot: [-Math.PI / 2, 0, Math.PI] as [number,number,number],  color: '#6366f1', text: 'BACK'   },
  { name: 'RIGHT',  pos: [0.501, 0, 0]  as [number,number,number], rot: [0, 0, -Math.PI / 2] as [number,number,number],        color: '#10b981', text: 'RIGHT'  },
  { name: 'LEFT',   pos: [-0.501, 0, 0] as [number,number,number], rot: [0, 0, Math.PI / 2] as [number,number,number],         color: '#10b981', text: 'LEFT'   },
  { name: 'TOP',    pos: [0, 0, 0.501]  as [number,number,number], rot: [0, 0, 0] as [number,number,number],                   color: '#f59e0b', text: 'TOP'    },
  { name: 'BOTTOM', pos: [0, 0, -0.501] as [number,number,number], rot: [Math.PI, 0, 0] as [number,number,number],             color: '#f59e0b', text: 'BOTTOM' },
]

export default function ViewCube() {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const cubeCamRef  = useRef<ArcRotateCamera | null>(null)
  const mainCamera  = useViewerStore((s) => s.cameraRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false, alpha: true })
    const scene  = new Scene(engine)
    scene.useRightHandedSystem = true
    scene.clearColor = new Color4(0, 0, 0, 0)

    // Orthographic camera — no perspective distortion
    const camera = new ArcRotateCamera('cubeCamera', -Math.PI / 4, Math.PI / 3, 2.8, Vector3.Zero(), scene)
    camera.upVector = new Vector3(0, 0, 1)
    camera.minZ = 0.01
    camera.maxZ = 20
    camera.inputs.clear()
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA
    // Ortho size: fits the unit cube comfortably in the canvas
    const orthoHalf = 0.82
    camera.orthoLeft   = -orthoHalf
    camera.orthoRight  =  orthoHalf
    camera.orthoTop    =  orthoHalf
    camera.orthoBottom = -orthoHalf
    cubeCamRef.current = camera

    // Lighting
    const hemi = new HemisphericLight('cubeHemi', new Vector3(0, 0, 1), scene)
    hemi.intensity = 1.1
    hemi.diffuse = new Color3(1, 1, 1)
    hemi.groundColor = new Color3(0.55, 0.55, 0.6)

    const dirLight = new DirectionalLight('cubeDir', new Vector3(-1, -1, -1).normalize(), scene)
    dirLight.intensity = 0.5

    // Cube body (light gray)
    const box = MeshBuilder.CreateBox('cubeBody', { size: 1 }, scene)
    const boxMat = new StandardMaterial('cubeBodyMat', scene)
    boxMat.diffuseColor = Color3.FromHexString('#e8eaf0')
    boxMat.specularColor = new Color3(0.1, 0.1, 0.12)
    box.material = boxMat
    box.isPickable = false

    // Dark edges on the box — XViewr style
    box.enableEdgesRendering()
    box.edgesWidth   = 6
    box.edgesColor   = new Color4(0.05, 0.05, 0.08, 1)

    // Face planes with full-word labels
    FACE_DEFS.forEach((def) => {
      const plane = MeshBuilder.CreatePlane(`face_${def.name}`, { size: 1.0 }, scene)
      plane.position = new Vector3(...def.pos)
      plane.rotation = new Vector3(...def.rot)

      const tex = new DynamicTexture(`tex_${def.name}`, { width: 256, height: 256 }, scene, false)
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D

      // Face fill
      ctx.fillStyle = def.color
      ctx.fillRect(0, 0, 256, 256)

      // Dark inner border (XViewr style thick dark edges)
      ctx.strokeStyle = 'rgba(0,0,0,0.60)'
      ctx.lineWidth = 16
      ctx.strokeRect(8, 8, 240, 240)

      // Label
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 42px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(def.text, 128, 128)
      tex.update()

      const mat = new StandardMaterial(`mat_${def.name}`, scene)
      mat.diffuseTexture = tex
      mat.specularColor  = new Color3(0, 0, 0)
      mat.emissiveColor  = new Color3(0.12, 0.12, 0.12)
      mat.backFaceCulling = true
      plane.material = mat
      plane.metadata  = { viewName: def.name }
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
