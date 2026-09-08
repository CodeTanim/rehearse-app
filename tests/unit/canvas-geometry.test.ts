import { describe, expect, it } from "vitest"
import { boundedPosition, defaultNodePosition, fitCanvas } from "@/lib/learning/canvas-geometry"

describe("canvas geometry", () => {
  it("has stable, separated default positions", () => {
    expect(defaultNodePosition(0)).toEqual({ x: 40, y: 70 })
    expect(defaultNodePosition(3)).toEqual({ x: 40, y: 290 })
    expect(new Set(Array.from({ length: 50 }, (_, index) => JSON.stringify(defaultNodePosition(index)))).size).toBe(50)
  })
  it.each([1, 10, 50])("fits %s nodes within a bounded viewport", (count) => {
    const nodes = Array.from({ length: count }, (_, index) => ({ ...defaultNodePosition(index), width: 200, height: 150 }))
    const view = fitCanvas(nodes, 640, 560)
    for (const node of nodes) {
      expect((node.x - 100) * view.zoom + view.offset.x).toBeGreaterThanOrEqual(31.9)
      expect((node.x + 100) * view.zoom + view.offset.x).toBeLessThanOrEqual(608.1)
      expect((node.y - 75) * view.zoom + view.offset.y).toBeGreaterThanOrEqual(31.9)
      expect((node.y + 75) * view.zoom + view.offset.y).toBeLessThanOrEqual(528.1)
    }
  })
  it("recovers widely moved nodes and bounds placement", () => {
    expect(boundedPosition({ x: -20000, y: 12345 })).toEqual({ x: -10000, y: 10000 })
    const view = fitCanvas([{ x: -10000, y: -10000, width: 200, height: 150 }, { x: 10000, y: 10000, width: 200, height: 150 }], 640, 560)
    expect(view.zoom).toBeLessThan(0.03)
    expect(fitCanvas([], 640, 560)).toEqual({ zoom: 1, offset: { x: 0, y: 0 } })
  })
})
