"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Info, Loader2, X } from "lucide-react";

import type { ConceptGraph } from "@/lib/queries/graph";

const ConceptGraph = dynamic(
  () => import("@/components/concept-graph").then((m) => m.ConceptGraph),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Laying out the map…
      </div>
    ),
  },
);

const LEGEND_KEY = "choti:mapLegend";

function LegendBody() {
  return (
    <>
      <div className="space-y-1">
        <p className="font-medium">Mastery — fill colour</p>
        <div
          className="h-2 w-full rounded-full"
          style={{
            background:
              "linear-gradient(to right, var(--clay), var(--highlight), var(--sage))",
          }}
        />
        <div className="text-muted-foreground flex justify-between">
          <span>Struggling</span>
          <span>Learning</span>
          <span>Mastered</span>
        </div>
        <p className="text-muted-foreground flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-full"
            style={{ background: "var(--color-muted-foreground)" }}
          />
          not reviewed yet
        </p>
      </div>

      <div className="space-y-1">
        <p className="font-medium">Lapses — ring</p>
        <div className="text-muted-foreground flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="border-border size-3 rounded-full border bg-transparent" />
            none
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-full bg-transparent ring-1 ring-[var(--clay)]" />
            1–2
          </span>
          <span className="flex items-center gap-1">
            <span className="size-3 rounded-full bg-transparent ring-2 ring-[var(--clay)]" />
            3+
          </span>
        </div>
      </div>

      <p className="text-muted-foreground">
        <span className="text-foreground font-medium">Size &amp; fade</span> —
        reviewed more often is bigger and bolder. Grouped by subject.
      </p>
    </>
  );
}

function Legend() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let initial: boolean;
    try {
      const stored = localStorage.getItem(LEGEND_KEY);
      initial =
        stored != null
          ? stored === "1"
          : window.matchMedia("(min-width: 640px)").matches;
    } catch {
      initial = true;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(initial);
  }, []);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(LEGEND_KEY, next ? "1" : "0");
    } catch {
      /* private mode — fine */
    }
  }

  if (!open) {
    // Top-left so the pill stays visible even where the map runs past the fold
    // (the embedded map on /review).
    return (
      <button
        type="button"
        onClick={() => toggle(true)}
        className="border-rule bg-background/85 text-muted-foreground hover:text-foreground absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm transition"
      >
        <Info className="size-3.5" /> Legend
      </button>
    );
  }

  return (
    <div className="border-rule bg-background/90 absolute bottom-2 left-2 z-10 max-w-[15rem] space-y-2 rounded-lg border p-2.5 text-[11px] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="text-foreground font-semibold">Legend</p>
        <button
          type="button"
          onClick={() => toggle(false)}
          aria-label="Hide legend"
          className="text-muted-foreground hover:text-foreground -m-1 p-1 transition"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <LegendBody />
    </div>
  );
}

export function ConceptGraphView({ graph }: { graph: ConceptGraph }) {
  const { nodes, subjects, truncated } = graph;

  if (nodes.length === 0) {
    return (
      <div className="border-rule text-muted-foreground flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center text-sm">
        No cards in this branch yet.
      </div>
    );
  }

  return (
    <div className="border-rule bg-card relative h-full overflow-hidden rounded-xl border">
      <ConceptGraph nodes={nodes} subjects={subjects} />
      <Legend />

      {truncated && (
        <div className="text-muted-foreground bg-background/85 absolute top-2 right-2 z-10 rounded-md px-2 py-1 text-[11px] backdrop-blur-sm">
          Showing the 400 most-reviewed cards
        </div>
      )}
    </div>
  );
}
