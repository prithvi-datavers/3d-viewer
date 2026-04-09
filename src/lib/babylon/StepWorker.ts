/**
 * Web Worker — runs OpenCASCADE WASM off the main thread.
 * Receives file bytes, returns raw geometry arrays.
 * Main thread builds Babylon meshes from the geometry.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let oc: any = null

async function initOC() {
  if (oc) return oc
  const mod = await import('opencascade.js')
  const initOpenCascade = mod.default
  if (typeof initOpenCascade !== 'function') throw new Error('opencascade.js default export is not a function')
  oc = await initOpenCascade()
  return oc
}

export interface StepPart {
  positions: Float32Array
  normals:   Float32Array
  indices:   Uint32Array
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTriangulation(occ: any, shape: any): { positions: number[]; normals: number[]; indices: number[] } {
  const allPositions: number[] = []
  const allNormals:   number[] = []
  const allIndices:   number[] = []
  let indexOffset = 0

  const faceExplorer = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_FACE, occ.TopAbs_ShapeEnum.TopAbs_SHAPE)
  while (faceExplorer.More()) {
    const face     = occ.TopoDS.Face_1(faceExplorer.Current())
    const location = new occ.TopLoc_Location_1()
    try {
      const triHandle = occ.BRep_Tool.Triangulation(face, location, 0)
      if (!triHandle.IsNull()) {
        const tri        = triHandle.get()
        const nbNodes    = tri.NbNodes()
        const nbTris     = tri.NbTriangles()
        const trsf       = location.Transformation()
        const isReversed = face.Orientation_1() === occ.TopAbs_Orientation.TopAbs_REVERSED

        for (let i = 1; i <= nbNodes; i++) {
          const node = tri.Node(i)
          const t    = node.Transformed(trsf)
          allPositions.push(t.X(), t.Y(), t.Z())
          allNormals.push(0, 0, 0)
          t.delete(); node.delete()
        }

        for (let i = 1; i <= nbTris; i++) {
          const triangle = tri.Triangle(i)
          let n1 = triangle.Value(1) - 1 + indexOffset
          let n2 = triangle.Value(2) - 1 + indexOffset
          let n3 = triangle.Value(3) - 1 + indexOffset
          triangle.delete()
          if (isReversed) { const tmp = n2; n2 = n3; n3 = tmp }
          allIndices.push(n1, n2, n3)

          const p1x = allPositions[n1*3], p1y = allPositions[n1*3+1], p1z = allPositions[n1*3+2]
          const p2x = allPositions[n2*3], p2y = allPositions[n2*3+1], p2z = allPositions[n2*3+2]
          const p3x = allPositions[n3*3], p3y = allPositions[n3*3+1], p3z = allPositions[n3*3+2]
          const ux = p2x-p1x, uy = p2y-p1y, uz = p2z-p1z
          const vx = p3x-p1x, vy = p3y-p1y, vz = p3z-p1z
          let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx
          const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
          if (len > 0) { nx /= len; ny /= len; nz /= len }
          if (isReversed) { nx = -nx; ny = -ny; nz = -nz }
          for (const idx of [n1, n2, n3]) {
            allNormals[idx*3] += nx; allNormals[idx*3+1] += ny; allNormals[idx*3+2] += nz
          }
        }
        indexOffset += nbNodes
      }
    } catch (_) { /* skip degenerate faces */ }
    location.delete()
    faceExplorer.Next()
  }
  faceExplorer.delete()

  for (let i = 0; i < allNormals.length; i += 3) {
    const len = Math.sqrt(allNormals[i]**2 + allNormals[i+1]**2 + allNormals[i+2]**2)
    if (len > 0) { allNormals[i] /= len; allNormals[i+1] /= len; allNormals[i+2] /= len }
  }
  return { positions: allPositions, normals: allNormals, indices: allIndices }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processSTEP(occ: any, fileBytes: Uint8Array): StepPart[] {
  const fileName = '/model.step'
  try { occ.FS.unlink(fileName) } catch (_) {}
  occ.FS.createDataFile('/', 'model.step', fileBytes, true, true, true)

  let shape: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    const reader = new occ.STEPControl_Reader_1()
    const status = reader.ReadFile(fileName)
    if (status !== occ.IFSelect_ReturnStatus.IFSelect_RetDone) throw new Error(`STEP read failed: ${status}`)
    reader.TransferRoots(new occ.Message_ProgressRange_1())
    shape = reader.OneShape()
    reader.delete()
  } finally {
    try { occ.FS.unlink(fileName) } catch (_) {}
  }

  new occ.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false)

  // Collect solids (or fall back to whole shape)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solids: any[] = []
  const exp = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_SOLID, occ.TopAbs_ShapeEnum.TopAbs_SHAPE)
  while (exp.More()) { solids.push(exp.Current()); exp.Next() }
  exp.delete()

  const parts = solids.length > 0 ? solids : [shape]
  const result: StepPart[] = []

  parts.forEach((partShape: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { positions, normals, indices } = extractTriangulation(occ, partShape)
    if (positions.length === 0) return
    result.push({
      positions: new Float32Array(positions),
      normals:   new Float32Array(normals),
      indices:   new Uint32Array(indices),
    })
  })

  shape.delete()
  return result
}

self.onmessage = async (e: MessageEvent) => {
  const { bytes } = e.data as { bytes: Uint8Array }
  try {
    const occ = await initOC()
    const parts = processSTEP(occ, bytes)
    // Transfer typed arrays back to main thread (zero-copy)
    const transfers: Transferable[] = parts.flatMap(p => [p.positions.buffer, p.normals.buffer, p.indices.buffer])
    ;(self as unknown as Worker).postMessage({ ok: true, parts }, transfers)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
