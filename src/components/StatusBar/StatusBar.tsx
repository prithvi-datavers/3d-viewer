import { useViewerStore } from '../../store/viewerStore'

interface Props {
  loadedFileName: string | null
}

export default function StatusBar({ loadedFileName }: Props) {
  const cursorPos = useViewerStore((s) => s.cursorPos)
  const cameraMode = useViewerStore((s) => s.cameraMode)
  const shadingMode = useViewerStore((s) => s.shadingMode)
  const measureMode = useViewerStore((s) => s.measureMode)

  return (
    <div className="statusbar">
      <span>X: {cursorPos.x}</span>
      <span>Y: {cursorPos.y}</span>
      <span>Z: {cursorPos.z}</span>
      <div className="statusbar-sep" />
      <span>{cameraMode === 'perspective' ? 'Persp' : 'Ortho'}</span>
      <div className="statusbar-sep" />
      <span style={{ textTransform: 'capitalize' }}>{shadingMode}</span>
      {measureMode && (
        <>
          <div className="statusbar-sep" />
          <span style={{ color: 'var(--accent)' }}>Measure Mode — Click two points</span>
        </>
      )}
      {loadedFileName && (
        <>
          <div className="statusbar-sep" />
          <span style={{ opacity: 0.5 }}>{loadedFileName}</span>
        </>
      )}
    </div>
  )
}
