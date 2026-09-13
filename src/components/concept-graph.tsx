"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { drag } from "d3-drag";
import {
  forceCenter,
  forceCollide,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
} from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";

import { Button } from "@/components/ui/button";
import { masteryColor, parseColor } from "@/lib/graph/mastery-color";
import { reviewChannels } from "@/lib/graph/node-size";
import type { GraphNode, GraphSubject } from "@/lib/queries/graph";

type SimNode = GraphNode & SimulationNodeDatum & { r: number; alpha: number };
type XY = { x: number; y: number };
type Marker = { node: GraphNode; x: number; y: number };

const radiusOf = (n: SimNode) => n.r;

/** The stats line shown in both the hover tooltip and the pinned popover. */
function detailLine(n: GraphNode): string {
  if (n.mastery == null) return "not reviewed yet";
  return `Mastery ${n.mastery}% · reviewed ${n.attempts}× · ${n.lapses} lapse${
    n.lapses === 1 ? "" : "s"
  }`;
}

function readColors() {
  const s = getComputedStyle(document.documentElement);
  const g = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    sage: g("--sage", "#3ddbb4"), // mint
    clay: g("--clay", "#f2647e"), // rose
    highlight: g("--highlight", "#7c6cf3"), // violet
    muted: g("--color-muted-foreground", "#99a1b0"),
    card: g("--card", "#1c1f26"),
    fg: g("--foreground", "#f2f4f8"),
  };
}

type Colors = ReturnType<typeof readColors>;

function nodeFill(n: GraphNode, c: Colors): string {
  if (n.mastery == null) return c.muted; // never reviewed — not on the gradient
  return masteryColor(n.mastery, { low: c.clay, mid: c.highlight, high: c.sage });
}

/** Ring stroke width (screen px) for a lapse count, or 0 for none. */
const ringWidth = (lapses: number) => (lapses >= 3 ? 3 : lapses >= 1 ? 1.5 : 0);

/**
 * Cluster anchors: each top-level subject gets a point on a ring around the
 * canvas centre; its child subjects fan out in a small circle around it, so
 * sibling sub-topics sit together. Recomputed whenever the canvas resizes.
 */
function computeAnchors(
  subjects: GraphSubject[],
  width: number,
  height: number,
): Map<string, XY> {
  const cx = width / 2;
  const cy = height / 2;
  const roots = [...new Set(subjects.map((s) => s.rootId))];
  const single = roots.length <= 1;
  const R = Math.min(width, height) * 0.32;
  // With one root (a subject-scoped map) fan its children out wide to fill the
  // canvas; with many roots keep child fans tight so clusters stay separable.
  const sub = Math.min(width, height) * (single ? 0.3 : 0.13);

  const rootPos = new Map<string, XY>();
  roots.forEach((rid, i) => {
    if (single) {
      rootPos.set(rid, { x: cx, y: cy });
      return;
    }
    const a = (i / roots.length) * 2 * Math.PI - Math.PI / 2;
    rootPos.set(rid, { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  });

  const byRoot = new Map<string, GraphSubject[]>();
  for (const s of subjects) {
    const list = byRoot.get(s.rootId);
    if (list) list.push(s);
    else byRoot.set(s.rootId, [s]);
  }

  const anchors = new Map<string, XY>();
  for (const [rid, list] of byRoot) {
    const base = rootPos.get(rid) ?? { x: cx, y: cy };
    if (list.length === 1) {
      anchors.set(list[0].id, base);
      continue;
    }
    if (list.some((s) => s.id === rid)) anchors.set(rid, base);
    const kids = list.filter((s) => s.id !== rid);
    kids.forEach((s, j) => {
      const a = (j / kids.length) * 2 * Math.PI;
      anchors.set(s.id, {
        x: base.x + Math.cos(a) * sub,
        y: base.y + Math.sin(a) * sub,
      });
    });
  }
  return anchors;
}

/**
 * Force-directed concept map on a canvas.
 *   position → clustered by subject branch (subjects.parent_id)
 *   size     → review/quiz attempt count (sqrt-scaled, normalised to p90 in view)
 *   fill     → Mastery % from rating history (red→yellow→green); grey = New
 *   ring     → FSRS lapse count (thin 1–2, bold 3+)
 *
 * Interaction: hover shows a read-only tooltip (desktop); a tap/click pins a
 * popover with an "Open" button — navigation only happens from that button, so
 * a stray tap never yanks you into a card. No AI, no edges.
 */
export function ConceptGraph({
  nodes: rawNodes,
  subjects,
}: {
  nodes: GraphNode[];
  subjects: GraphSubject[];
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Marker | null>(null);
  const [pinned, setPinned] = useState<Marker | null>(null);

  // Drop the pinned popover whenever the graph's data changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned(null);
  }, [rawNodes, subjects]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ch = reviewChannels(rawNodes.map((n) => n.attempts));
    const nodes: SimNode[] = rawNodes.map((n) => ({
      ...n,
      r: ch.radius(n.attempts),
      alpha: ch.opacity(n.attempts),
    }));

    const nodesBySubject = new Map<string, SimNode[]>();
    for (const n of nodes) {
      const list = nodesBySubject.get(n.subjectId);
      if (list) list.push(n);
      else nodesBySubject.set(n.subjectId, [n]);
    }
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    const subjectRgb = new Map(
      subjects.map((s) => [s.id, parseColor(s.color ?? "#99a1b0")]),
    );

    let colors = readColors();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = wrap.clientWidth;
    let height = wrap.clientHeight;
    let anchors = computeAnchors(subjects, width, height);
    let transform: ZoomTransform = zoomIdentity;
    let hoverId: string | null = null;
    let pinnedId: string | null = null;
    let raf = 0;

    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const anchorFor = (d: SimNode) =>
      anchors.get(d.subjectId) ?? { x: width / 2, y: height / 2 };

    const sim: Simulation<SimNode, undefined> = forceSimulation(nodes)
      .force("charge", forceManyBody<SimNode>().strength(-40))
      .force("x", forceX<SimNode>((d) => anchorFor(d).x).strength(0.22))
      .force("y", forceY<SimNode>((d) => anchorFor(d).y).strength(0.22))
      // keep the whole layout centred without adding energy between clusters
      .force("center", forceCenter<SimNode>(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => radiusOf(d) + 3),
      );

    function draw() {
      ctx!.save();
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.translate(transform.x, transform.y);
      ctx!.scale(transform.k, transform.k);

      // subject clusters — faint disc always; label only for clusters big
      // enough (or the one under the cursor) to keep the account-wide view legible
      const activeId = hoverId ?? pinnedId;
      const activeSubject = activeId
        ? nodes.find((n) => n.id === activeId)?.subjectId
        : null;
      for (const [sid, list] of nodesBySubject) {
        let sx = 0;
        let sy = 0;
        let k = 0;
        for (const n of list) {
          if (n.x == null || n.y == null) continue;
          sx += n.x;
          sy += n.y;
          k += 1;
        }
        if (k === 0) continue;
        const cx = sx / k;
        const cy = sy / k;
        let spread = 0;
        for (const n of list) {
          if (n.x == null || n.y == null) continue;
          spread = Math.max(spread, Math.hypot(n.x - cx, n.y - cy) + n.r);
        }
        const [r, g, b] = subjectRgb.get(sid) ?? [123, 116, 107];
        ctx!.beginPath();
        ctx!.arc(cx, cy, spread + 16, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, 0.06)`;
        ctx!.fill();

        if (k >= 2 || sid === activeSubject) {
          const name = subjectName.get(sid) ?? "";
          const ly = cy - spread - 18 / transform.k;
          ctx!.font = `${11 / transform.k}px var(--font-sans, system-ui)`;
          ctx!.textAlign = "center";
          const tw = ctx!.measureText(name).width;
          const pad = 4 / transform.k;
          ctx!.fillStyle = `rgba(${r}, ${g}, ${b}, 0.10)`;
          ctx!.fillRect(
            cx - tw / 2 - pad,
            ly - 9 / transform.k,
            tw + pad * 2,
            13 / transform.k,
          );
          ctx!.fillStyle = colors.fg;
          ctx!.fillText(name, cx, ly);
        }
      }

      // nodes
      for (const n of nodes) {
        if (n.x == null || n.y == null) continue;
        const rad = radiusOf(n);
        const isActive = n.id === hoverId || n.id === pinnedId;

        // fill opacity tracks review count alongside size (an active node is
        // always fully opaque so the hovered/pinned card reads clearly)
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, rad, 0, Math.PI * 2);
        ctx!.globalAlpha = isActive ? 1 : n.alpha;
        ctx!.fillStyle = nodeFill(n, colors);
        ctx!.fill();
        ctx!.globalAlpha = 1;
        ctx!.lineWidth = (isActive ? 2.5 : 1.25) / transform.k;
        ctx!.strokeStyle = isActive ? colors.fg : colors.card;
        ctx!.stroke();

        const rw = ringWidth(n.lapses);
        if (rw > 0) {
          ctx!.beginPath();
          ctx!.arc(n.x, n.y, rad + rw / transform.k + 1, 0, Math.PI * 2);
          ctx!.lineWidth = rw / transform.k;
          ctx!.strokeStyle = colors.clay;
          ctx!.stroke();
        }

        if (isActive) {
          ctx!.fillStyle = colors.fg;
          ctx!.font = `${11 / transform.k}px var(--font-sans, system-ui)`;
          ctx!.textAlign = "center";
          const label =
            n.title.length > 26 ? `${n.title.slice(0, 25)}…` : n.title;
          ctx!.fillText(label, n.x, n.y + rad + 12 / transform.k);
        }
      }
      ctx!.restore();
    }

    function schedule() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        draw();
      });
    }

    let lastW = width;
    let lastH = height;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    function setCanvasSize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
    }

    /**
     * Re-measure only after the container genuinely changed size. Mobile
     * browsers fire ResizeObserver constantly as the address bar shows/hides,
     * so this is debounced and — crucially — never touches `transform`
     * (pan/zoom) or the settled node positions. Only a large change (a device
     * rotation) gently re-runs the layout.
     */
    function applyResize() {
      const w = wrap!.clientWidth;
      const h = wrap!.clientHeight;
      if (w === lastW && h === lastH) return;
      const big = Math.abs(w - lastW) > 96 || Math.abs(h - lastH) > 96;
      width = w;
      height = h;
      lastW = w;
      lastH = h;
      setCanvasSize();
      anchors = computeAnchors(subjects, width, height);
      sim.force("center", forceCenter<SimNode>(width / 2, height / 2));
      if (big) {
        if (reduce) {
          sim.alpha(0.3);
          for (let i = 0; i < 200; i += 1) sim.tick();
        } else {
          sim.alpha(0.15).restart();
        }
      }
      draw();
    }

    // pointer → graph coords
    const toGraph = (clientX: number, clientY: number) => {
      const rect = canvas!.getBoundingClientRect();
      return transform.invert([clientX - rect.left, clientY - rect.top]);
    };
    const nodeAt = (gx: number, gy: number): SimNode | undefined => {
      for (let i = nodes.length - 1; i >= 0; i -= 1) {
        const n = nodes[i];
        if (n.x == null) continue;
        const r = radiusOf(n) + 3;
        if ((n.x - gx) ** 2 + (n.y! - gy) ** 2 <= r * r) return n;
      }
      return undefined;
    };

    // zoom / pan
    const zoomBehaviour = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 4])
      .filter((e) => !(e.type === "mousedown" && dragging))
      .on("zoom", (e) => {
        transform = e.transform;
        schedule();
      });
    const sel = select(canvas);
    sel.call(zoomBehaviour);

    // drag nodes
    let dragging = false;
    let moved = false;
    const dragBehaviour = drag<HTMLCanvasElement, unknown>()
      .subject((e) => {
        const [gx, gy] = toGraph(e.sourceEvent.clientX, e.sourceEvent.clientY);
        return nodeAt(gx, gy);
      })
      .on("start", (e) => {
        if (!e.subject) return;
        dragging = true;
        moved = false;
        if (!e.active) sim.alphaTarget(0.3).restart();
        (e.subject as SimNode).fx = (e.subject as SimNode).x;
        (e.subject as SimNode).fy = (e.subject as SimNode).y;
      })
      .on("drag", (e) => {
        if (!e.subject) return;
        moved = true;
        const [gx, gy] = toGraph(e.sourceEvent.clientX, e.sourceEvent.clientY);
        (e.subject as SimNode).fx = gx;
        (e.subject as SimNode).fy = gy;
      })
      .on("end", (e) => {
        dragging = false;
        if (!e.subject) return;
        if (!e.active) sim.alphaTarget(0);
        (e.subject as SimNode).fx = null;
        (e.subject as SimNode).fy = null;
      });
    sel.call(dragBehaviour);

    // popover position, clamped inside the wrapper
    const markerAt = (n: SimNode, clientX: number, clientY: number): Marker => {
      const rect = wrap!.getBoundingClientRect();
      return {
        node: n,
        x: Math.min(clientX - rect.left + 12, width - 190),
        y: Math.min(clientY - rect.top + 12, height - 108),
      };
    };

    function onMove(ev: PointerEvent) {
      const [gx, gy] = toGraph(ev.clientX, ev.clientY);
      const n = nodeAt(gx, gy);
      hoverId = n?.id ?? null;
      canvas!.style.cursor = n ? "pointer" : "grab";
      setHover(n ? markerAt(n, ev.clientX, ev.clientY) : null);
      schedule();
    }
    function onClick(ev: MouseEvent) {
      if (moved) {
        moved = false;
        return;
      }
      const [gx, gy] = toGraph(ev.clientX, ev.clientY);
      const n = nodeAt(gx, gy);
      // Tap a node → pin its popover (no navigation). Tap empty → dismiss.
      pinnedId = n?.id ?? null;
      setPinned(n ? markerAt(n, ev.clientX, ev.clientY) : null);
      schedule();
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape" && pinnedId) {
        pinnedId = null;
        setPinned(null);
        schedule();
      }
    }
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", () => {
      hoverId = null;
      setHover(null);
      schedule();
    });
    canvas.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);

    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(applyResize, 200);
    });
    ro.observe(wrap);

    const mo = new MutationObserver(() => {
      colors = readColors();
      draw();
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    setCanvasSize();
    draw();
    if (reduce) {
      sim.stop();
      for (let i = 0; i < 400; i += 1) sim.tick();
      draw();
    } else {
      sim.on("tick", schedule);
    }

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      sim.stop();
      sim.on("tick", null);
      sel.on(".zoom", null).on(".drag", null);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      ro.disconnect();
      mo.disconnect();
    };
  }, [rawNodes, subjects]);

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {/* read-only hover preview (desktop) — hidden while a node is pinned */}
      {hover && !pinned && (
        <div
          className="border-rule bg-popover pointer-events-none absolute z-10 max-w-[15rem] space-y-0.5 rounded-lg border p-2 text-xs shadow-lg"
          style={{ left: hover.x, top: hover.y }}
        >
          <p className="font-medium">{hover.node.title}</p>
          <p className="text-muted-foreground">
            {hover.node.subjectName ?? "—"} · {detailLine(hover.node)}
          </p>
        </div>
      )}

      {/* pinned popover — the only path to opening a card */}
      {pinned && (
        <div
          className="border-rule bg-popover absolute z-20 max-w-[16rem] space-y-1.5 rounded-lg border p-2.5 text-xs shadow-lg"
          style={{ left: pinned.x, top: pinned.y }}
        >
          <div className="space-y-0.5">
            <p className="font-medium">{pinned.node.title}</p>
            <p className="text-muted-foreground">
              {pinned.node.subjectName ?? "—"} · {detailLine(pinned.node)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-7 gap-1 px-2.5 text-xs"
              onClick={() =>
                router.push(
                  `/subjects/${pinned.node.subjectId}?card=${pinned.node.id}`,
                )
              }
            >
              Open <ArrowRight className="size-3.5" />
            </Button>
            <button
              type="button"
              onClick={() => setPinned(null)}
              className="text-muted-foreground hover:text-foreground transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
