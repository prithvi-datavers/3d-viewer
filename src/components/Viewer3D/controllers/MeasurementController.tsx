import { useEffect, useRef } from 'react'
import { PointerEventTypes } from '@babylonjs/core'
import type { AbstractMesh, Vector3 } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import { createPickMarker, buildMeasurement } from '../../../lib/babylon/MeasurementManager'
import { isOverlayMesh } from '../../../lib/babylon/SelectionManager'

export default function MeasurementController() {
  const scene = useViewerStore((s) => s.babylonScene)
  const measureMode = useViewerStore((s) => s.measureMode)
  const addMeasurement = useViewerStore((s) => s.addMeasurement)

  const pendingPoint = useRef<Vector3 | null>(null)
  const pendingMarker = useRef<AbstractMesh | null>(null)

  // Clear pending when mode is toggled off
  useEffect(() => {
    if (!measureMode) {
      pendingPoint.current = null
      if (pendingMarker.current) {
        try { pendingMarker.current.dispose() } catch (_) {}
        pendingMarker.current = null
      }
    }
  }, [measureMode])

  useEffect(() => {
    if (!scene || !measureMode) return

    const observer = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      if (!info.pickInfo?.hit || !info.pickInfo.pickedPoint) return

      const mesh = info.pickInfo.pickedMesh
      if (mesh && isOverlayMesh(mesh.name)) return

      const point = info.pickInfo.pickedPoint.clone()

      if (!pendingPoint.current) {
        // First click — store point and show marker
        const marker = createPickMarker(scene, point, `pickMarker_first_${Date.now()}`)
        pendingPoint.current = point
        pendingMarker.current = marker
      } else {
        // Second click — complete measurement
        const p1 = pendingPoint.current
        const p2 = point
        const marker2 = createPickMarker(scene, p2, `pickMarker_second_${Date.now()}`)
        const entry = buildMeasurement(scene, p1, p2, pendingMarker.current!, marker2)
        addMeasurement(entry)
        pendingPoint.current = null
        pendingMarker.current = null
      }
    })

    return () => scene.onPointerObservable.remove(observer)
  }, [scene, measureMode, addMeasurement])

  return null
}
