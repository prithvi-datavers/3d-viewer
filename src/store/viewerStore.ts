import { create } from 'zustand'
import type { Scene, ArcRotateCamera } from '@babylonjs/core'
import type { ShadingMode, CameraMode, MeasurementEntry, SelectionInfo, PartEntry } from '../types/viewer'

interface ViewerStore {
  // Scene
  babylonScene: Scene | null
  cameraRef: ArcRotateCamera | null
  cursorPos: { x: string; y: string; z: string }
  setBabylonScene: (s: Scene | null) => void
  setCameraRef: (c: ArcRotateCamera | null) => void
  setCursorPos: (p: { x: string; y: string; z: string }) => void

  // View settings
  shadingMode: ShadingMode
  cameraMode: CameraMode
  gridVisible: boolean
  axesVisible: boolean
  setShadingMode: (m: ShadingMode) => void
  setCameraMode: (m: CameraMode) => void
  toggleGrid: () => void
  toggleAxes: () => void

  // Measurement
  measureMode: boolean
  measurements: MeasurementEntry[]
  toggleMeasureMode: () => void
  addMeasurement: (m: MeasurementEntry) => void
  removeMeasurement: (id: string) => void
  clearMeasurements: () => void

  // Selection
  selectedMeshName: string | null
  selectionInfo: SelectionInfo | null
  setSelection: (name: string | null, info: SelectionInfo | null) => void

  // File loading status
  loadedFileName: string | null
  loadingMsg: string | null
  setLoadedFileName: (name: string | null) => void
  setLoadingMsg: (msg: string | null) => void

  // Model tree
  modelParts: PartEntry[]
  setModelParts: (parts: PartEntry[]) => void
  setPartVisibility: (name: string, visible: boolean) => void
}

export const useViewerStore = create<ViewerStore>((set) => ({
  // Scene
  babylonScene: null,
  cameraRef: null,
  cursorPos: { x: '0.00', y: '0.00', z: '0.00' },
  setBabylonScene: (babylonScene) => set({ babylonScene }),
  setCameraRef: (cameraRef) => set({ cameraRef }),
  setCursorPos: (cursorPos) => set({ cursorPos }),

  // View settings
  shadingMode: 'shaded',
  cameraMode: 'perspective',
  gridVisible: true,
  axesVisible: true,
  setShadingMode: (shadingMode) => set({ shadingMode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleAxes: () => set((s) => ({ axesVisible: !s.axesVisible })),

  // Measurement
  measureMode: false,
  measurements: [],
  toggleMeasureMode: () => set((s) => ({ measureMode: !s.measureMode })),
  addMeasurement: (m) => set((s) => ({ measurements: [...s.measurements, m] })),
  removeMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [] }),

  // Selection
  selectedMeshName: null,
  selectionInfo: null,
  setSelection: (selectedMeshName, selectionInfo) => set({ selectedMeshName, selectionInfo }),

  // File loading status
  loadedFileName: null,
  loadingMsg: null,
  setLoadedFileName: (loadedFileName) => set({ loadedFileName }),
  setLoadingMsg: (loadingMsg) => set({ loadingMsg }),

  // Model tree
  modelParts: [],
  setModelParts: (modelParts) => set({ modelParts }),
  setPartVisibility: (name, visible) =>
    set((s) => ({ modelParts: s.modelParts.map((p) => p.name === name ? { ...p, visible } : p) })),
}))
