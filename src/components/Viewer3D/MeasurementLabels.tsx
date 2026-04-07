import { useEffect, useState } from 'react'
import { Vector3, Matrix, Viewport } from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'

interface ScreenPos {
  id: string
  x: number
  y: number
  display: string
}

export default function MeasurementLabels() {
  const scene = useViewerStore((s) => s.babylonScene)
  const measurements = useViewerStore((s) => s.measurements)
  const [positions, setPositions] = useState<ScreenPos[]>([])

  useEffect(() => {
    if (!scene || measurements.length === 0) {
      setPositions([])
      return
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
      const engine = scene.getEngine()
      const camera = scene.activeCamera
      if (!camera) return

      const vw = engine.getRenderWidth()
      const vh = engine.getRenderHeight()
      const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix())
      const viewport = new Viewport(0, 0, vw, vh)

      const next: ScreenPos[] = []
      for (const m of measurements) {
        if (!m.midpoint) continue
        const projected = Vector3.Project(
          m.midpoint,
          Matrix.Identity(),
          transform,
          viewport
        )
        if (projected.z < 0 || projected.z > 1) continue
        next.push({ id: m.id, x: projected.x, y: projected.y, display: m.display })
      }
      setPositions(next)
    })

    return () => { scene.onBeforeRenderObservable.remove(observer) }
  }, [scene, measurements])

  return (
    <>
      {positions.map((p) => (
        <div
          key={p.id}
          className="measure-label"
          style={{ left: p.x, top: p.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
        >
          {p.display}
        </div>
      ))}
    </>
  )
}
