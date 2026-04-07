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
} from '@babylonjs/core'

// Camera params — position [5, -6, 3.5] targeting origin
const dx = 5, dy = -6, dz = 3.5
const CAMERA_RADIUS = Math.sqrt(dx * dx + dy * dy + dz * dz)
const CAMERA_ALPHA = Math.atan2(-dy, dx)
const CAMERA_BETA = Math.acos(dz / CAMERA_RADIUS)

export interface SceneSetup {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
  gridMesh: { setEnabled: (v: boolean) => void }
}

export function initScene(canvas: HTMLCanvasElement): SceneSetup {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  })

  const scene = new Scene(engine)
  scene.useRightHandedSystem = true
  scene.clearColor = new Color4(0.078, 0.078, 0.169, 1)

  // Camera
  const camera = new ArcRotateCamera('camera', CAMERA_ALPHA, CAMERA_BETA, CAMERA_RADIUS, new Vector3(0, 0, 0.5), scene)
  camera.upVector = new Vector3(0, 0, 1)
  camera.attachControl(canvas, true)
  camera.inertia = 0.92
  camera.panningInertia = 0.92
  camera.allowUpsideDown = true
  camera.minZ = 0.01
  camera.maxZ = 1000
  camera.fov = (45 * Math.PI) / 180
  camera.wheelPrecision = 20
  camera.panningSensibility = 100

  // Lights
  const hemi = new HemisphericLight('hemiLight', new Vector3(0, 0, 1), scene)
  hemi.intensity = 0.8
  hemi.diffuse = Color3.FromHexString('#b1e1ff')
  hemi.groundColor = Color3.FromHexString('#443366')

  const main = new DirectionalLight('mainLight', new Vector3(-5, 5, -8).normalize(), scene)
  main.intensity = 1.2

  const fill = new DirectionalLight('fillLight', new Vector3(3, -4, -2).normalize(), scene)
  fill.intensity = 0.4

  // Grid + axes
  const gridMesh = buildGrid(scene)
  buildOriginCompass(scene)

  engine.runRenderLoop(() => scene.render())

  return { engine, scene, camera, gridMesh }
}

function buildGrid(scene: Scene) {
  const size = 12
  const divisions = 24
  const step = size / divisions
  const half = size / 2

  const majorColor = Color3.FromHexString('#333355')
  const minorColor = Color3.FromHexString('#222244')

  const lines: Vector3[][] = []
  const colors: Color4[][] = []

  for (let i = 0; i <= divisions; i++) {
    const pos = -half + i * step
    const isMajor = i % 4 === 0
    const color = isMajor ? majorColor : minorColor
    const c4 = new Color4(color.r, color.g, color.b, 1)

    lines.push([new Vector3(pos, -half, 0), new Vector3(pos, half, 0)])
    colors.push([c4, c4])
    lines.push([new Vector3(-half, pos, 0), new Vector3(half, pos, 0)])
    colors.push([c4, c4])
  }

  const grid = MeshBuilder.CreateLineSystem('viewerGrid', { lines, colors, useVertexAlpha: false }, scene)
  grid.isPickable = false
  return grid
}

function buildOriginCompass(scene: Scene) {
  const len = 0.5
  const axes = [
    { dir: new Vector3(len, 0, 0), color: '#ef4444' },
    { dir: new Vector3(0, len, 0), color: '#22c55e' },
    { dir: new Vector3(0, 0, len), color: '#3b82f6' },
  ]

  axes.forEach((ax, i) => {
    const c = Color3.FromHexString(ax.color)
    const c4 = new Color4(c.r, c.g, c.b, 1)

    const line = MeshBuilder.CreateLines(`originAxis_${i}`, {
      points: [Vector3.Zero(), ax.dir],
      colors: [c4, c4],
    }, scene)
    line.isPickable = false

    const tip = MeshBuilder.CreateSphere(`originTip_${i}`, { diameter: 0.06 }, scene)
    tip.position = ax.dir.clone()
    const mat = new StandardMaterial(`originTipMat_${i}`, scene)
    mat.diffuseColor = c
    mat.emissiveColor = c.scale(0.4)
    tip.material = mat
    tip.isPickable = false
  })
}
