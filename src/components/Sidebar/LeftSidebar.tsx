import { MousePointer2, Layers, LayoutGrid, Ruler, Eye } from 'lucide-react'
import type { ReactNode } from 'react'

export type SidebarPanel = 'select' | 'display' | 'view' | 'measure' | 'tree'

const ITEMS: { id: SidebarPanel; icon: ReactNode; label: string }[] = [
  { id: 'select',  icon: <MousePointer2 size={18} strokeWidth={1.75} />, label: 'Select'  },
  { id: 'display', icon: <Layers        size={18} strokeWidth={1.75} />, label: 'Display' },
  { id: 'view',    icon: <Eye           size={18} strokeWidth={1.75} />, label: 'View'    },
  { id: 'measure', icon: <Ruler         size={18} strokeWidth={1.75} />, label: 'Measure' },
  { id: 'tree',    icon: <LayoutGrid    size={18} strokeWidth={1.75} />, label: 'Tree'    },
]

interface Props {
  activePanel: SidebarPanel | null
  onSelect: (panel: SidebarPanel | null) => void
}

export default function LeftSidebar({ activePanel, onSelect }: Props) {
  return (
    <div className="left-sidebar">
      {ITEMS.map(({ id, icon, label }, i) => (
        <>
          {i === ITEMS.length - 1 && <div key={`sep-${id}`} className="sidebar-sep" />}
          <div
            key={id}
            className={`sidebar-item${activePanel === id ? ' active' : ''}`}
            onClick={() => onSelect(activePanel === id ? null : id)}
          >
            {icon}
            <span className="sidebar-item-label">{label}</span>
          </div>
        </>
      ))}
    </div>
  )
}
