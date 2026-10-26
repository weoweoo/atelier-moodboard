import { useCallback, useEffect, useRef } from 'react'
import {
  adaptiveGridStep,
  clampZoom,
  screenToWorld,
  zoomAtScreenPoint,
} from '../lib/coords'

const ZOOM_SMOOTHING = 16

function pointerInViewport(event, viewport) {
  const rect = viewport.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function isZoomWheel(event) {
  return event.ctrlKey || event.metaKey || event.altKey || event.deltaMode === 1
}

/**
 * Owns the world camera (pan + zoom) and writes CSS transforms on rAF.
 * Pan tracks the pointer 1:1. Zoom eases toward a target while re-anchoring
 * at the cursor so the spatial point under the pointer does not drift.
 */
export function useInfiniteCamera({
  viewportRef,
  worldRef,
  onFrame,
} = {}) {
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 })
  const targetZoomRef = useRef(1)
  const zoomAnchorRef = useRef({ x: 0, y: 0 })
  const spaceDownRef = useRef(false)
  const panRef = useRef(null)
  const pinchRef = useRef(null)
  const pointersRef = useRef(new Map())

  const applyFrame = useCallback(() => {
    const viewport = viewportRef.current
    const world = worldRef.current
    const camera = cameraRef.current
    if (!viewport || !world) return

    world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`

    const minor = adaptiveGridStep(camera.zoom)
    const major = minor * 5
    viewport.style.setProperty('--grid-minor', `${minor * camera.zoom}px`)
    viewport.style.setProperty('--grid-major', `${major * camera.zoom}px`)
    viewport.style.setProperty('--grid-x', `${camera.x}px`)
    viewport.style.setProperty('--grid-y', `${camera.y}px`)

    onFrame?.({ ...camera, grid: minor })
  }, [onFrame, viewportRef, worldRef])

  const centerOrigin = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const { width, height } = viewport.getBoundingClientRect()
    cameraRef.current = { x: width / 2, y: height / 2, zoom: 1 }
    targetZoomRef.current = 1
    applyFrame()
  }, [applyFrame, viewportRef])

  const setZoomAt = useCallback(
    (screenX, screenY, nextZoom) => {
      zoomAnchorRef.current = { x: screenX, y: screenY }
      targetZoomRef.current = clampZoom(nextZoom)
    },
    [],
  )

  const zoomBy = useCallback(
    (factor, screen) => {
      const viewport = viewportRef.current
      if (!viewport) return
      const rect = viewport.getBoundingClientRect()
      const anchor = screen ?? { x: rect.width / 2, y: rect.height / 2 }
      setZoomAt(anchor.x, anchor.y, targetZoomRef.current * factor)
    },
    [setZoomAt, viewportRef],
  )

  useEffect(() => {
    let frame = 0
    let last = performance.now()

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const camera = cameraRef.current
      const targetZoom = targetZoomRef.current

      if (Math.abs(targetZoom - camera.zoom) > 0.00008) {
        const t = 1 - Math.exp(-ZOOM_SMOOTHING * dt)
        const nextZoom = camera.zoom + (targetZoom - camera.zoom) * t
        const { x, y } = zoomAnchorRef.current
        cameraRef.current = zoomAtScreenPoint(camera, x, y, nextZoom)
      } else if (camera.zoom !== targetZoom) {
        const { x, y } = zoomAnchorRef.current
        cameraRef.current = zoomAtScreenPoint(camera, x, y, targetZoom)
      }

      applyFrame()
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [applyFrame])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (event) => {
      event.preventDefault()
      const point = pointerInViewport(event, viewport)

      if (isZoomWheel(event) || Math.abs(event.deltaX) < 0.5) {
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
        const factor = Math.exp(-delta * 0.0018)
        setZoomAt(point.x, point.y, targetZoomRef.current * factor)
        return
      }

      cameraRef.current = {
        ...cameraRef.current,
        x: cameraRef.current.x - event.deltaX,
        y: cameraRef.current.y - event.deltaY,
      }
    }

    const onPointerDown = (event) => {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })
      viewport.setPointerCapture?.(event.pointerId)

      if (pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()]
        pinchRef.current = {
          startDistance: distance(a, b),
          startZoom: cameraRef.current.zoom,
          startMid: midpoint(
            pointerInViewport({ clientX: a.x, clientY: a.y }, viewport),
            pointerInViewport({ clientX: b.x, clientY: b.y }, viewport),
          ),
        }
        panRef.current = null
        return
      }

      const panButton = event.button === 1 || event.button === 0
      if (panButton || spaceDownRef.current) {
        panRef.current = { x: event.clientX, y: event.clientY }
        viewport.classList.add('is-panning')
      }
    }

    const onPointerMove = (event) => {
      if (pointersRef.current.has(event.pointerId)) {
        pointersRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
      }

      if (pointersRef.current.size === 2 && pinchRef.current) {
        const [a, b] = [...pointersRef.current.values()]
        const nextDist = distance(a, b)
        const mid = midpoint(
          pointerInViewport({ clientX: a.x, clientY: a.y }, viewport),
          pointerInViewport({ clientX: b.x, clientY: b.y }, viewport),
        )
        const scale = nextDist / pinchRef.current.startDistance
        zoomAnchorRef.current = mid
        const nextZoom = clampZoom(pinchRef.current.startZoom * scale)
        targetZoomRef.current = nextZoom
        cameraRef.current = zoomAtScreenPoint(cameraRef.current, mid.x, mid.y, nextZoom)
        return
      }

      if (!panRef.current) return
      const dx = event.clientX - panRef.current.x
      const dy = event.clientY - panRef.current.y
      panRef.current = { x: event.clientX, y: event.clientY }
      cameraRef.current = {
        ...cameraRef.current,
        x: cameraRef.current.x + dx,
        y: cameraRef.current.y + dy,
      }
    }

    const endPointer = (event) => {
      pointersRef.current.delete(event.pointerId)
      if (pointersRef.current.size < 2) pinchRef.current = null
      if (pointersRef.current.size === 0) {
        panRef.current = null
        viewport.classList.remove('is-panning')
      }
    }

    const onKeyDown = (event) => {
      if (event.code === 'Space') {
        spaceDownRef.current = true
        viewport.classList.add('is-pan-ready')
      }
      if (event.code === 'Equal' || event.code === 'NumpadAdd') {
        event.preventDefault()
        zoomBy(1.18)
      }
      if (event.code === 'Minus' || event.code === 'NumpadSubtract') {
        event.preventDefault()
        zoomBy(1 / 1.18)
      }
      if (event.code === 'Digit0' || event.code === 'Numpad0') {
        event.preventDefault()
        centerOrigin()
      }
    }

    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        spaceDownRef.current = false
        viewport.classList.remove('is-pan-ready')
      }
    }

    const onBlur = () => {
      spaceDownRef.current = false
      panRef.current = null
      pinchRef.current = null
      pointersRef.current.clear()
      viewport.classList.remove('is-panning', 'is-pan-ready')
    }

    const onContextMenu = (event) => event.preventDefault()

    viewport.addEventListener('wheel', onWheel, { passive: false })
    viewport.addEventListener('pointerdown', onPointerDown)
    viewport.addEventListener('pointermove', onPointerMove)
    viewport.addEventListener('pointerup', endPointer)
    viewport.addEventListener('pointercancel', endPointer)
    viewport.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    const resize = new ResizeObserver(() => {
      if (
        cameraRef.current.x === 0 &&
        cameraRef.current.y === 0 &&
        cameraRef.current.zoom === 1
      ) {
        centerOrigin()
      } else {
        applyFrame()
      }
    })
    resize.observe(viewport)
    centerOrigin()

    return () => {
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('pointerdown', onPointerDown)
      viewport.removeEventListener('pointermove', onPointerMove)
      viewport.removeEventListener('pointerup', endPointer)
      viewport.removeEventListener('pointercancel', endPointer)
      viewport.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      resize.disconnect()
    }
  }, [applyFrame, centerOrigin, setZoomAt, viewportRef, zoomBy])

  const worldFromPointer = useCallback((event) => {
    const viewport = viewportRef.current
    if (!viewport) return { x: 0, y: 0 }
    const point = pointerInViewport(event, viewport)
    return screenToWorld(point.x, point.y, cameraRef.current)
  }, [viewportRef])

  return {
    cameraRef,
    centerOrigin,
    zoomBy,
    worldFromPointer,
  }
}
