/**
 * STEP file loader using opencascade.js (v1.x) WASM.
 * Adapted from CAD_MVP_V1/stepLoaderOCC.js.
 * Returns Babylon.js meshes ready to add to the scene.
 */
import type { Scene, AbstractMesh } from '@babylonjs/core'
import { Mesh, TransformNode, VertexData, PBRMaterial, Color3, Vector3 } from '@babylonjs/core'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ocInstance: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initPromise: Promise<any> | null = null

const DEFAULT_COLORS = [
  '#B0B8C0', '#A0A8B0', '#8894A0', '#98A0A8', '#C0C8D0',
  '#7888A0', '#B8C0C8', '#9098A8', '#A8B0B8', '#8090A0',
]

export type StepProgressCallback = (msg: string) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getOC(): Promise<any> {
  if (ocInstance) return ocInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const initOpenCascade = (await import('opencascade.js')).default
    const oc = await initOpenCascade()
    ocInstance = oc
    return oc
  })()

  return initPromise
}

export async function loadSTEP(
  file: File,
  scene: Scene,
  onProgress: StepProgressCallback = () => {}
): Promise<AbstractMesh[]> {
  // Read file bytes
  onProgress('Reading file...')
  const buffer = await file.arrayBuffer()
  const fileBytes = new Uint8Array(buffer)

  // Init WASM (lazy, singleton)
  onProgress('Initializing OpenCASCADE WASM...')
  const oc = await getOC()

  // Write to Emscripten virtual FS
  onProgress('Parsing STEP geometry...')
  const fileName = '/model.step'

  // Remove existing file if present
  try { oc.FS.unlink(fileName) } catch (_) {}
  oc.FS.createDataFile('/', 'model.step', fileBytes, true, true, true)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let shape: any
  try {
    const reader = new oc.STEPControl_Reader_1()
    const readResult = reader.ReadFile(fileName)

    if (readResult !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
      throw new Error(`STEP read failed with status: ${readResult}`)
    }

    reader.TransferRoots(new oc.Message_ProgressRange_1())
    shape = reader.OneShape()
    reader.delete()
  } finally {
    try { oc.FS.unlink(fileName) } catch (_) {}
  }

  // Tessellate
  onProgress('Tessellating surfaces...')
  new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false)

  // Build meshes
  onProgress('Building 3D meshes...')
  const meshes = buildMeshes(oc, scene, shape)

  shape.delete()

  onProgress('')
  return meshes
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMeshes(oc: any, scene: Scene, shape: any): AbstractMesh[] {
  const result: AbstractMesh[] = []
  const wrapper = new TransformNode('STEPModelWrapper', scene)

  // Collect solids
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solids: any[] = []
  const solidExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_SOLID,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  )
  while (solidExplorer.More()) {
    solids.push(solidExplorer.Current())
    solidExplorer.Next()
  }
  solidExplorer.delete()

  const parts = solids.length > 0 ? solids : [shape]

  parts.forEach((partShape, idx) => {
    const { positions, normals, indices } = extractTriangulation(oc, partShape)
    if (positions.length === 0) return

    const mesh = new Mesh(`StepPart_${idx}`, scene)
    const vd = new VertexData()
    vd.positions = positions
    vd.normals = normals
    vd.indices = indices
    vd.applyToMesh(mesh)

    const mat = new PBRMaterial(`stepMat_${idx}`, scene)
    mat.albedoColor = Color3.FromHexString(DEFAULT_COLORS[idx % DEFAULT_COLORS.length])
    mat.roughness = 0.35
    mat.metallic = 0.4
    mat.clearCoat.isEnabled = true
    mat.clearCoat.intensity = 0.1
    mat.backFaceCulling = false
    mesh.material = mat
    mesh.parent = wrapper

    result.push(mesh)
  })

  if (result.length === 0) {
    wrapper.dispose()
    return result
  }

  // Auto-scale to fit viewport (~6 units max)
  wrapper.computeWorldMatrix(true)
  const { min, max } = wrapper.getHierarchyBoundingVectors(true)
  const size = max.subtract(min)
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim > 0) {
    const scale = 6 / maxDim
    wrapper.scaling = new Vector3(scale, scale, scale)
  }

  // Center
  wrapper.computeWorldMatrix(true)
  const scaled = wrapper.getHierarchyBoundingVectors(true)
  const center = Vector3.Center(scaled.min, scaled.max)
  wrapper.position = new Vector3(-center.x, -center.y, -scaled.min.z)

  // Return flat list (wrapper is parent, meshes are children)
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTriangulation(oc: any, shape: any) {
  const allPositions: number[] = []
  const allNormals: number[] = []
  const allIndices: number[] = []
  let indexOffset = 0

  const faceExplorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  )

  while (faceExplorer.More()) {
    const face = oc.TopoDS.Face_1(faceExplorer.Current())
    const location = new oc.TopLoc_Location_1()

    try {
      const triHandle = oc.BRep_Tool.Triangulation(face, location, 0)
      if (!triHandle.IsNull()) {
        const tri = triHandle.get()
        const nbNodes = tri.NbNodes()
        const nbTriangles = tri.NbTriangles()
        const trsf = location.Transformation()
        const isReversed = face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED

        for (let i = 1; i <= nbNodes; i++) {
          const node = tri.Node(i)
          const t = node.Transformed(trsf)
          allPositions.push(t.X(), t.Y(), t.Z())
          allNormals.push(0, 0, 0) // placeholder, computed below
          t.delete()
          node.delete()
        }

        for (let i = 1; i <= nbTriangles; i++) {
          const triangle = tri.Triangle(i)
          let n1 = triangle.Value(1) - 1 + indexOffset
          let n2 = triangle.Value(2) - 1 + indexOffset
          let n3 = triangle.Value(3) - 1 + indexOffset
          triangle.delete()

          if (isReversed) { const tmp = n2; n2 = n3; n3 = tmp }
          allIndices.push(n1, n2, n3)

          const p1x = allPositions[n1 * 3], p1y = allPositions[n1 * 3 + 1], p1z = allPositions[n1 * 3 + 2]
          const p2x = allPositions[n2 * 3], p2y = allPositions[n2 * 3 + 1], p2z = allPositions[n2 * 3 + 2]
          const p3x = allPositions[n3 * 3], p3y = allPositions[n3 * 3 + 1], p3z = allPositions[n3 * 3 + 2]

          const ux = p2x - p1x, uy = p2y - p1y, uz = p2z - p1z
          const vx = p3x - p1x, vy = p3y - p1y, vz = p3z - p1z
          let nx = uy * vz - uz * vy
          let ny = uz * vx - ux * vz
          let nz = ux * vy - uy * vx
          const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
          if (len > 0) { nx /= len; ny /= len; nz /= len }
          if (isReversed) { nx = -nx; ny = -ny; nz = -nz }

          for (const idx of [n1, n2, n3]) {
            allNormals[idx * 3] += nx
            allNormals[idx * 3 + 1] += ny
            allNormals[idx * 3 + 2] += nz
          }
        }

        indexOffset += nbNodes
      }
    } catch (_) { /* skip degenerate faces */ }

    location.delete()
    faceExplorer.Next()
  }
  faceExplorer.delete()

  // Normalize accumulated normals
  for (let i = 0; i < allNormals.length; i += 3) {
    const len = Math.sqrt(allNormals[i] ** 2 + allNormals[i + 1] ** 2 + allNormals[i + 2] ** 2)
    if (len > 0) { allNormals[i] /= len; allNormals[i + 1] /= len; allNormals[i + 2] /= len }
  }

  return {
    positions: new Float32Array(allPositions),
    normals: new Float32Array(allNormals),
    indices: new Uint32Array(allIndices),
  }
}
