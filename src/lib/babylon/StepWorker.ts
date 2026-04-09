/**
 * Web Worker — runs OpenCASCADE WASM off the main thread.
 * Receives file bytes, returns raw geometry arrays with part names.
 *
 * Reading strategy (tried in order):
 *   1. STEPCAFControl_Reader  — reads product structure; extracts real part names
 *   2. STEPControl_Reader     — geometry only; falls back to "Part N" names
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
  name:      string
}

// ── Triangulation ─────────────────────────────────────────────────────────────

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

// ── XCAF name helpers ─────────────────────────────────────────────────────────

/** Read TDataStd_Name from a TDF_Label. Returns '' if not found. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLabelName(occ: any, label: any): string {
  try {
    const nameHandle = new occ.Handle_TDataStd_Name_1()
    if (label.FindAttribute_1(occ.TDataStd_Name.GetID(), nameHandle) && !nameHandle.IsNull()) {
      const raw = nameHandle.get().Get().ToCString()
      const trimmed = (raw ?? '').trim()
      if (trimmed) return trimmed
    }
  } catch (_) { /* attribute not present */ }
  return ''
}

// ── XCAF reader (with part names) ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readWithXCAF(occ: any, fileName: string): StepPart[] {
  // Create a bare XDE document (no application needed for in-memory use)
  const docPtr    = new occ.TDocStd_Document(new occ.TCollection_ExtendedString_2('MDTV-CAF', false))
  const docHandle = new occ.Handle_TDocStd_Document_1()
  docHandle.reset(docPtr)

  // Read STEP with XCAF reader so product names are preserved
  const reader = new occ.STEPCAFControl_Reader_1()
  reader.SetNameMode(true)
  const status = reader.ReadFile(fileName)
  if (status !== occ.IFSelect_ReturnStatus.IFSelect_RetDone) {
    reader.delete(); docPtr.delete()
    throw new Error(`STEPCAFControl_Reader failed: ${status}`)
  }
  reader.Transfer_1(docHandle, new occ.Message_ProgressRange_1())
  reader.delete()

  // Access shape tool
  const shapeTool = occ.XCAFDoc_DocumentTool.ShapeTool(docHandle.get().Main())

  // Collect top-level shape labels
  const freeSeq = new occ.TDF_LabelSequence_1()
  shapeTool.get().GetFreeShapes(freeSeq)
  const nFree = freeSeq.Length()

  // Build the list of per-part labels to triangulate.
  // If there is a single root assembly, expand it one level so each
  // named component becomes a separate tree entry.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const partLabels: any[] = []

  if (nFree === 1 && occ.XCAFDoc_ShapeTool.IsAssembly(freeSeq.Value(1))) {
    const compSeq = new occ.TDF_LabelSequence_1()
    occ.XCAFDoc_ShapeTool.GetComponents(freeSeq.Value(1), compSeq, false)
    const nComp = compSeq.Length()
    if (nComp > 0) {
      for (let i = 1; i <= nComp; i++) partLabels.push(compSeq.Value(i))
    } else {
      partLabels.push(freeSeq.Value(1))          // empty assembly → use root
    }
    compSeq.delete()
  } else {
    for (let i = 1; i <= nFree; i++) partLabels.push(freeSeq.Value(i))
  }
  freeSeq.delete()

  // Triangulate each part
  const result: StepPart[] = []

  partLabels.forEach((label: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    // Resolve name: try the label itself, then the referenced definition
    let name = getLabelName(occ, label)
    if (!name) {
      try {
        const refLabel = new occ.TDF_Label()
        if (occ.XCAFDoc_ShapeTool.GetReferredShape(label, refLabel)) {
          name = getLabelName(occ, refLabel)
        }
        refLabel.delete()
      } catch (_) {}
    }
    name = name || `Part ${idx + 1}`

    const shape = occ.XCAFDoc_ShapeTool.GetShape_2(label)
    new occ.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false)

    const { positions, normals, indices } = extractTriangulation(occ, shape)
    shape.delete()

    if (positions.length === 0) return
    result.push({
      name,
      positions: new Float32Array(positions),
      normals:   new Float32Array(normals),
      indices:   new Uint32Array(indices),
    })
  })

  docPtr.delete()
  return result
}

// ── Geometry-only reader (fallback, no names) ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readGeometryOnly(occ: any, fileName: string): StepPart[] {
  const reader = new occ.STEPControl_Reader_1()
  const status = reader.ReadFile(fileName)
  if (status !== occ.IFSelect_ReturnStatus.IFSelect_RetDone) {
    reader.delete()
    throw new Error(`STEPControl_Reader failed: ${status}`)
  }
  reader.TransferRoots(new occ.Message_ProgressRange_1())
  const shape = reader.OneShape()
  reader.delete()

  new occ.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solids: any[] = []
  const exp = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_SOLID, occ.TopAbs_ShapeEnum.TopAbs_SHAPE)
  while (exp.More()) { solids.push(exp.Current()); exp.Next() }
  exp.delete()

  const parts = solids.length > 0 ? solids : [shape]
  const result: StepPart[] = []

  parts.forEach((partShape: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { positions, normals, indices } = extractTriangulation(occ, partShape)
    if (positions.length === 0) return
    result.push({
      name: `Part ${idx + 1}`,
      positions: new Float32Array(positions),
      normals:   new Float32Array(normals),
      indices:   new Uint32Array(indices),
    })
  })

  shape.delete()
  return result
}

// ── Entry point ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processSTEP(occ: any, fileBytes: Uint8Array): StepPart[] {
  const fileName = '/model.step'
  try { occ.FS.unlink(fileName) } catch (_) {}
  occ.FS.createDataFile('/', 'model.step', fileBytes, true, true, true)

  try {
    // Prefer XCAF reader for real part names
    try {
      const parts = readWithXCAF(occ, fileName)
      if (parts.length > 0) return parts
    } catch (_) { /* fall through to geometry-only */ }

    return readGeometryOnly(occ, fileName)
  } finally {
    try { occ.FS.unlink(fileName) } catch (_) {}
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { bytes } = e.data as { bytes: Uint8Array }
  try {
    const occ = await initOC()
    const parts = processSTEP(occ, bytes)
    const transfers: Transferable[] = parts.flatMap(p => [p.positions.buffer, p.normals.buffer, p.indices.buffer])
    ;(self as unknown as Worker).postMessage({ ok: true, parts }, transfers)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
