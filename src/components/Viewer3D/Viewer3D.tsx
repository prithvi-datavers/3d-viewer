import { useRef, useEffect, useState } from 'react'
import { Camera } from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { initScene } from '../../lib/babylon/SceneManager'
import { loadFile, loadSampleGeometry } from '../../lib/babylon/ModelLoader'
import { applyShadingMode, getModelMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'
import ViewCube from '../ViewCube/ViewCube'
import MeasurementLabels from './MeasurementLabels'
import ShadingController from './controllers/ShadingController'
import SelectionController from './controllers/SelectionController'
import MeasurementController from './controllers/MeasurementController'
import StatusBar from '../StatusBar/StatusBar'

export default function Viewer3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)

  const setBabylonScene = useViewerStore((s) => s.setBabylonScene)
  const setCameraRef = useViewerStore((s) => s.setCameraRef)
  const setCursorPos = useViewerStore((s) => s.setCursorPos)
  const gridVisible = useViewerStore((s) => s.gridVisible)
  const shadingMode = useViewerStore((s) => s.shadingMode)
  const cameraMode = useViewerStore((s) => s.cameraMode)
  const measureMode = useViewerStore((s) => s.measureMode)

  // Keep refs for use inside effects
  const gridMeshRef = useRef<{ setEnabled: (v: boolean) => void } | null>(null)
  const sceneRef = useRef<import('@babylonjs/core').Scene | null>(null)
  const engineRef = useRef<import('@babylonjs/core').Engine | null>(null)
  const cameraInternalRef = useRef<import('@babylonjs/core').ArcRotateCamera | null>(null)

  // Init Babylon
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { engine, scene, camera, gridMesh } = initScene(canvas)
    engineRef.current = engine
    sceneRef.current = scene
    cameraInternalRef.current = camera
    gridMeshRef.current = gridMesh

    setBabylonScene(scene)
    setCameraRef(camera)

    // Load sample geometry immediately
    const samples = loadSampleGeometry(scene)
    fitToScene(camera, scene.meshes.slice())

    // Cursor tracking
    scene.onPointerMove = () => {
      const pick = scene.pick(scene.pointerX, scene.pointerY)
      if (pick?.hit && pick.pickedPoint) {
        const p = pick.pickedPoint
        setCursorPos({ x: p.x.toFixed(2), y: p.y.toFixed(2), z: p.z.toFixed(2) })
      }
    }

    // Wheel prevent page scroll
    const onWheel = (e: WheelEvent) => e.preventDefault()
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => {
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('wheel', onWheel)
      ro.disconnect()
      scene.dispose()
      engine.dispose()
      setBabylonScene(null)
      setCameraRef(null)
    }
  }, [])

  // Grid toggle
  useEffect(() => {
    if (gridMeshRef.current) gridMeshRef.current.setEnabled(gridVisible)
  }, [gridVisible])

  // Camera mode toggle
  useEffect(() => {
    const cam = cameraInternalRef.current
    const engine = engineRef.current
    if (!cam || !engine) return
    if (cameraMode === 'orthographic') {
      cam.mode = Camera.ORTHOGRAPHIC_CAMERA
      const orthoSize = cam.radius * Math.tan(cam.fov / 2)
      const aspect = engine.getAspectRatio(cam)
      cam.orthoLeft = -orthoSize * aspect
      cam.orthoRight = orthoSize * aspect
      cam.orthoTop = orthoSize
      cam.orthoBottom = -orthoSize
    } else {
      cam.mode = Camera.PERSPECTIVE_CAMERA
    }
  }, [cameraMode])

  // Cursor style in measure mode
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = measureMode ? 'crosshair' : 'default'
    }
  }, [measureMode])

  // Drag-and-drop file loading
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file || !sceneRef.current || !cameraInternalRef.current) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['glb', 'gltf'].includes(ext || '')) {
      alert('Please drop a .glb or .gltf file')
      return
    }
    try {
      // Clear existing model meshes
      const toRemove = getModelMeshes(sceneRef.current)
      toRemove.forEach((m) => m.dispose())
      const meshes = await loadFile(file, sceneRef.current)
      setLoadedFileName(file.name)
      // Apply current shading
      applyShadingMode(shadingMode, meshes)
      fitToScene(cameraInternalRef.current, sceneRef.current.meshes.slice())
    } catch (err) {
      console.error('Failed to load model:', err)
      alert('Failed to load model. Make sure it is a valid GLTF/GLB file.')
    }
  }

  return (
    <div
      className="viewer-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} className="viewer-canvas" />

      {/* Headless controllers */}
      <ShadingController />
      <SelectionController />
      <MeasurementController />

      {/* Overlays */}
      <MeasurementLabels />
      <ViewCube />
      <StatusBar loadedFileName={loadedFileName} />

      {isDragging && (
        <div className="drop-overlay">Drop GLTF / GLB file here</div>
      )}
    </div>
  )
}
