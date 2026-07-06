// Frame-coalesced dirty tracking for the cook path. Param edits, node adds, and
// connection changes enqueue (contextKey, nodeId) pairs; one flush per animation
// frame cooks the union of dirty nodes plus their downstream, so a slider drag at
// any tick rate costs one cook pass per frame instead of one per event.
//
// contextKey is "root" for the root graph or the owning GeoNode id for a subflow.

const scheduleFrame: (cb: () => void) => number =
  typeof requestAnimationFrame !== "undefined"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(cb, 16) as unknown as number;

const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame !== "undefined"
    ? (id) => cancelAnimationFrame(id)
    : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>);

export class CookScheduler {
  private dirty = new Map<string, Set<string>>();
  private frameId: number | null = null;

  constructor(private flushFn: (batch: Map<string, Set<string>>) => void) {}

  enqueue(contextKey: string, nodeId: string): void {
    let nodes = this.dirty.get(contextKey);
    if (!nodes) {
      nodes = new Set();
      this.dirty.set(contextKey, nodes);
    }
    nodes.add(nodeId);
    if (this.frameId === null) {
      this.frameId = scheduleFrame(() => {
        this.frameId = null;
        this.flushNow();
      });
    }
  }

  // Synchronously cook everything queued. Also the test hook: node test
  // environments have no real animation frames.
  flushNow(): void {
    if (this.dirty.size === 0) return;
    const batch = this.dirty;
    this.dirty = new Map();
    this.flushFn(batch);
  }

  clear(): void {
    this.dirty = new Map();
    if (this.frameId !== null) {
      cancelFrame(this.frameId);
      this.frameId = null;
    }
  }
}
