"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { searchFlashcards, type SearchHit } from "@/actions/search";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

export function GlobalSearch() {
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startSearch] = useTransition();

  // Debounced query. A token guards against out-of-order responses.
  const reqRef = useRef(0);
  useEffect(() => {
    const q = term.trim();
    const token = ++reqRef.current;
    if (q.length < 2) return;
    const t = setTimeout(() => {
      startSearch(async () => {
        const res = await searchFlashcards(q);
        if (reqRef.current === token) {
          setHits(res);
          setActive(0);
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  // Only show results once the term is long enough — bumping reqRef above also
  // invalidates any in-flight request from a now-too-short term.
  const visibleHits = term.trim().length >= 2 ? hits : [];

  // ⌘K / Ctrl+K focuses the field from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  function goTo(hit: SearchHit) {
    setOpen(false);
    setTerm("");
    setHits([]);
    inputRef.current?.blur();
    router.push(`/subjects/${hit.subjectId}?card=${hit.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || visibleHits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % visibleHits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + visibleHits.length) % visibleHits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = visibleHits[active];
      if (hit) goTo(hit);
    }
  }

  const showPanel = open && term.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1 sm:max-w-sm">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search all cards…"
        className={cn(
          "border-rule bg-secondary/60 focus:bg-background h-9 w-full rounded-md border pr-9 pl-8 text-sm",
          "outline-none focus:ring-2 focus:ring-[var(--color-ring)]",
        )}
      />
      <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 text-[10px] font-medium sm:block">
        ⌘K
      </kbd>

      {showPanel && (
        <div
          id={listboxId}
          role="listbox"
          className="border-rule bg-popover absolute inset-x-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-lg border p-1 shadow-lg ring-1 ring-black/5"
        >
          {pending && visibleHits.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Searching…
            </p>
          ) : visibleHits.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              No cards match &ldquo;{term.trim()}&rdquo;.
            </p>
          ) : (
            <ul>
              {visibleHits.map((hit, i) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => goTo(hit)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-md px-3 py-2 text-left",
                      i === active && "bg-accent",
                    )}
                  >
                    <span className="truncate text-sm font-medium">
                      {hit.title || hit.subtitle || "Flashcard"}
                    </span>
                    <span className="text-muted-foreground line-clamp-2 text-xs">
                      {hit.snippet}
                    </span>
                    <span className="text-muted-foreground/80 mt-0.5 truncate text-[11px]">
                      {hit.subjectPath}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
