/**
 * Lucide-style SVG-иконки (24×24 viewBox, stroke-based).
 * Все с единым стилем: stroke=currentColor, strokeWidth=2, round caps/joins.
 */
import type { CSSProperties } from 'react'

interface IconProps {
  size?: number
  style?: CSSProperties
  strokeWidth?: number
}

function base(size = 14, strokeWidth = 2, style?: CSSProperties): React.SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    style: { display: 'inline-block', flexShrink: 0, ...style },
  } as React.SVGProps<SVGSVGElement>
}

export function ArrowRight(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

export function ExternalLink(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export function Copy(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  )
}

export function Settings(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function Sparkles(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  )
}

export function ListChecks(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="m3 17 2 2 4-4" />
      <path d="m3 7 2 2 4-4" />
      <path d="M13 6h8" />
      <path d="M13 12h8" />
      <path d="M13 18h8" />
    </svg>
  )
}

export function AlertCircle(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  )
}

export function AlertTriangle(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  )
}

export function Info(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function Download(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  )
}

export function FileText(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}

export function RefreshCw(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  )
}

export function Trash2(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function Search(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function SearchCheck(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="m8 11 2 2 4-4" />
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export function Play(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" />
    </svg>
  )
}

export function CheckCircle2(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function MousePointer(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M6 3a1 1 0 0 0-1 1v14.5a.5.5 0 0 0 .8.4l4.4-3.1a1 1 0 0 1 1.2 0l5 3.8a.5.5 0 0 0 .8-.6L13.2 12H19a1 1 0 0 0 .7-1.7L6.7 3.3A1 1 0 0 0 6 3Z" />
    </svg>
  )
}

export function FilterX(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055" />
      <path d="m22 3-5 5" />
      <path d="m17 3 5 5" />
    </svg>
  )
}

export function X(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export function Key(p: IconProps = {}) {
  return (
    <svg {...base(p.size, p.strokeWidth, p.style)}>
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  )
}
