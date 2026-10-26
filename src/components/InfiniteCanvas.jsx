import { useCallback, useRef, useState } from 'react'
import { Minus, Plus, Scan } from 'lucide-react'
import { useInfiniteCamera } from '../hooks/useInfiniteCamera'
import { formatWorld } from '../lib/coords'

const MARKERS = [
  { x: 0, y: 0, label: 'Origin', detail: '0, 0' },
  { x: 420, y: -80, label: 'Atelier North', detail: '420, -80' },
  { x: -360, y: 240, label: 'Dye Lab', detail: '-360, 240' },
  { x: 280, y: 320, label: 'Textile Bay', detail: '280, 320' },
]

export default function InfiniteCanvas() {
  const viewportRef = useRef(null)
  const worldRef = useRef(null)
  const [hud, setHud] = useState({
    zoom: 1,
    grid: 56,
    cursor: { x: 0, y: 0 },
  })

  const onFrame = useCallback((camera) => {
    setHud((prev) => {
      if (
        Math.abs(prev.zoom - camera.zoom) < 0.0005 &&
        prev.grid === camera.grid
      ) {
        return prev
      }
      return { ...prev, zoom: camera.zoom, grid: camera.grid }
    })
  }, [])

  const { zoomBy, centerOrigin, worldFromPointer } = useInfiniteCamera({
    viewportRef,
    worldRef,
    onFrame,
  })

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0c0b0a]">
      <div
        ref={viewportRef}
        className="canvas-viewport absolute inset-0"
        onPointerMove={(event) => {
          const cursor = worldFromPointer(event)
          setHud((prev) => ({ ...prev, cursor }))
        }}
      >
        <div ref={worldRef} className="world-layer">
          <Axes />
          {MARKERS.map((marker) => (
            <WorldMarker key={marker.label} {...marker} />
          ))}
        </div>
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 py-5">
        <div>
          <p className="font-mono text-[10px] tracking-[0.28em] text-[#c4a574]">
            ATELIER
          </p>
          <h1 className="font-display text-3xl tracking-tight text-[#ece7df]">
            Spatial canvas
          </h1>
        </div>
        <p className="max-w-xs text-right font-mono text-[10px] leading-relaxed tracking-wide text-[#ece7df]/55">
          Drag to pan · Scroll to zoom toward cursor · Pinch or Ctrl-scroll · 0
          recenters
        </p>
      </header>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-6 py-5">
        <dl className="grid grid-cols-3 gap-6 font-mono text-[11px] text-[#ece7df]/80">
          <HudStat label="World X" value={formatWorld(hud.cursor.x)} />
          <HudStat label="World Y" value={formatWorld(hud.cursor.y)} />
          <HudStat label="Grid" value={`${formatWorld(hud.grid)} u`} />
        </dl>

        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md">
          <IconButton label="Zoom out" onClick={() => zoomBy(1 / 1.18)}>
            <Minus size={14} />
          </IconButton>
          <span className="min-w-16 text-center font-mono text-[11px] text-[#c4a574]">
            {Math.round(hud.zoom * 100)}%
          </span>
          <IconButton label="Zoom in" onClick={() => zoomBy(1.18)}>
            <Plus size={14} />
          </IconButton>
          <IconButton label="Reset view" onClick={centerOrigin}>
            <Scan size={14} />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

function HudStat({ label, value }) {
  return (
    <div>
      <dt className="text-[9px] tracking-[0.22em] text-[#ece7df]/40 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-[#ece7df]">{value}</dd>
    </div>
  )
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-[#ece7df] transition hover:bg-white/10"
    >
      {children}
    </button>
  )
}

function Axes() {
  return (
    <>
      <div className="pointer-events-none absolute top-0 left-0 h-px w-[20000px] -translate-x-1/2 bg-[#c4a574]/50" />
      <div className="pointer-events-none absolute top-0 left-0 h-[20000px] w-px -translate-y-1/2 bg-[#c4a574]/50" />
      <div className="absolute top-0 left-0 flex h-3 w-3 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#c4a574] bg-[#0c0b0a]" />
    </>
  )
}

function WorldMarker({ x, y, label, detail }) {
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className="h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ece7df] shadow-[0_0_0_4px_rgb(196_165_116_/_0.25)]" />
      <div className="mt-2 w-48 border border-white/10 bg-[#161412]/90 px-3 py-2 backdrop-blur-sm">
        <p className="font-display text-lg leading-none text-[#ece7df]">{label}</p>
        <p className="mt-1 font-mono text-[10px] tracking-wide text-[#c4a574]">
          {detail}
        </p>
      </div>
    </div>
  )
}
