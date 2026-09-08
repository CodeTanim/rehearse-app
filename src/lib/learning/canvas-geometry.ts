export type CanvasPoint = { x: number; y: number }
export const MIN_CANVAS_ZOOM = 0.01
export const MAX_CANVAS_ZOOM = 2.2
export const POSITION_LIMIT = 10_000

export function defaultNodePosition(index: number): CanvasPoint {
  return { x: 40 + (index % 3) * 280, y: 70 + Math.floor(index / 3) * 220 }
}

export function boundedPosition(point: CanvasPoint): CanvasPoint {
  return {
    x: Math.round(Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, point.x))),
    y: Math.round(Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, point.y))),
  }
}

export function fitCanvas(nodes: Array<CanvasPoint & { width: number; height: number }>, width: number, height: number) {
  if (!nodes.length || width <= 0 || height <= 0) return { zoom: 1, offset: { x: 0, y: 0 } }
  const left = Math.min(...nodes.map((node) => node.x - node.width / 2))
  const right = Math.max(...nodes.map((node) => node.x + node.width / 2))
  const top = Math.min(...nodes.map((node) => node.y - node.height / 2))
  const bottom = Math.max(...nodes.map((node) => node.y + node.height / 2))
  const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(1, (width - 64) / Math.max(1, right - left), (height - 64) / Math.max(1, bottom - top)))
  return { zoom, offset: { x: width / 2 - (left + right) / 2 * zoom, y: height / 2 - (top + bottom) / 2 * zoom } }
}
