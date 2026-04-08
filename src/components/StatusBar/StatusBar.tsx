import { useViewerStore } from '../../store/viewerStore'

interface Props {
  loadedFileName?: string | null  // kept for backward compat but now reads from store
}

export default function StatusBar(_props: Props) {
  const cursorPos      = useViewerStore((s) => s.cursorPos)
  const cameraMode     = useViewerStore((s) => s.cameraMode)
  const shadingMode    = useViewerStore((s) => s.shadingMode)
  const measureMode    = useViewerStore((s) => s.measureMode)
  const loadedFileName = useViewerStore((s) => s.loadedFileName)
  const loadingMsg     = useViewerStore((s) => s.loadingMsg)

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
          <span style={{ color: 'var(--accent)' }}>Measure — click two points</span>
        </>
      )}

      {loadingMsg && (
        <>
          <div className="statusbar-sep" />
          <span style={{ color: 'var(--accent)' }}>⏳ {loadingMsg}</span>
        </>
      )}

      {loadedFileName && !loadingMsg && (
        <>
          <div className="statusbar-sep" />
          <span style={{ color: 'var(--text-primary)', opacity: 0.7, fontWeight: 600 }}>
            {loadedFileName}
          </span>
        </>
      )}
    </div>
  )
}
