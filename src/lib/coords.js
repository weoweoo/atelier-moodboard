export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 12

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function clampZoom(zoom) {
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM)
}

/** Convert a viewport pixel to a world-space point. */
export function screenToWorld(screenX, screenY, camera) {
  return {
    x: (screenX - camera.x) / camera.zoom,
    y: (screenY - camera.y) / camera.zoom,
  }
}

/** Convert a world-space point to a viewport pixel. */
export function worldToScreen(worldX, worldY, camera) {
  return {
    x: worldX * camera.zoom + camera.x,
    y: worldY * camera.zoom + camera.y,
  }
}

/**
 * Change zoom while keeping the world point under (screenX, screenY) fixed.
 * This is what makes cursor-anchored zoom feel spatial instead of sliding.
 */
export function zoomAtScreenPoint(camera, screenX, screenY, nextZoom) {
  const zoom = clampZoom(nextZoom)
  const world = screenToWorld(screenX, screenY, camera)
  return {
    x: screenX - world.x * zoom,
    y: screenY - world.y * zoom,
    zoom,
  }
}

/** World-unit grid step that stays near `targetPx` on screen as you zoom. */
export function adaptiveGridStep(zoom, targetPx = 56) {
  const world = targetPx / zoom
  const magnitude = 10 ** Math.floor(Math.log10(world))
  const mantissa = world / magnitude
  if (mantissa <= 2) return 2 * magnitude
  if (mantissa <= 5) return 5 * magnitude
  return 10 * magnitude
}

export function formatWorld(n) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1000) return n.toFixed(0)
  if (abs >= 10) return n.toFixed(1)
  return n.toFixed(2)
}
