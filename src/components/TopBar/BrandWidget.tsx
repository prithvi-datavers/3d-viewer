import { Box } from 'lucide-react'

export default function BrandWidget() {
  return (
    <div className="brand-widget">
      <div className="brand-logo">
        <Box size={14} color="#fff" strokeWidth={2} />
      </div>
      <span className="brand-title">3D Viewer</span>
    </div>
  )
}
