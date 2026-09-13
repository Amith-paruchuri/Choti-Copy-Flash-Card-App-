"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { ImagePlus, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { describeCardImage } from "@/actions/card-images";
import { useFileDrop } from "@/components/drop-zone";
import {
  currentUserId,
  uploadCardImage,
  type UploadedCardImage,
} from "@/lib/media/upload-client";
import { MAX_CARD_IMAGES } from "@/lib/media/constants";
import { cn } from "@/lib/utils";

export interface CardImageValue extends UploadedCardImage {
  alt: string;
}

type Item = CardImageValue & {
  /** object URL (fresh upload) or signed URL (existing image). */
  previewUrl: string;
  /** true while its object URL needs revoking on removal. */
  local: boolean;
  status: "describing" | "ready";
};

/** Existing images passed in when editing a card. */
export interface InitialCardImage extends Partial<UploadedCardImage> {
  path: string;
  hash: string;
  mime: string;
  alt?: string;
  previewUrl: string;
}

/**
 * Attach image(s) to a flashcard: compress + upload client-side, then ask the
 * AI for a short description of each (searchable, and used for quiz generation
 * on image-primary cards). Serialises the set into a hidden `<input name>` for
 * the enclosing form.
 */
export function CardImageInput({
  name = "images",
  initial = [],
  cardContext,
  onImagesChange,
}: {
  name?: string;
  initial?: InitialCardImage[];
  /** Called at describe-time to focus the description on the card's topic. */
  cardContext?: () => string;
  /** Fires whenever the image set (or a description) changes — lets a parent
   * form read the current alt text without lifting the whole upload state. */
  onImagesChange?: (images: { alt: string }[]) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((i) => ({
      path: i.path,
      hash: i.hash,
      mime: i.mime,
      bytes: i.bytes ?? 0,
      alt: i.alt ?? "",
      previewUrl: i.previewUrl,
      local: false,
      status: "ready" as const,
    })),
  );

  useEffect(() => {
    currentUserId().then(setUserId);
  }, []);

  // Keep a ref to the current items for the event handlers and the unmount
  // cleanup, without reading `.current` during render.
  const itemsRef = useRef<Item[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  });

  // Let a parent (the "Suggest subject" flow) read the current alt text
  // without lifting the whole upload/describe state up. Deliberately keyed
  // only on `items` — `onImagesChange` is a plain callback prop, not itself
  // part of "has the image set changed".
  useEffect(() => {
    onImagesChange?.(items.map((it) => ({ alt: it.alt })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Revoke object URLs we own when the component unmounts.
  useEffect(
    () => () => {
      for (const it of itemsRef.current) {
        if (it.local) URL.revokeObjectURL(it.previewUrl);
      }
    },
    [],
  );

  const describe = useCallback(
    async (path: string, mime: string) => {
      const res = await describeCardImage({
        storagePath: path,
        mime,
        cardContext: cardContext?.()?.slice(0, 1000) || undefined,
      });
      setItems((prev) =>
        prev.map((it) =>
          it.path === path
            ? {
                ...it,
                status: "ready",
                alt: res.ok ? res.data.description : it.alt,
              }
            : it,
        ),
      );
      if (!res.ok) toast.error(res.error);
    },
    [cardContext],
  );

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!userId) {
      toast.error("Still signing in — try again in a moment.");
      return;
    }
    const room = MAX_CARD_IMAGES - items.length;
    const picked = [...files].slice(0, Math.max(0, room));
    if (picked.length < files.length) {
      toast.message(`Up to ${MAX_CARD_IMAGES} images per card.`);
    }

    setBusy(true);
    try {
      for (const file of picked) {
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} isn’t an image.`);
          continue;
        }
        let uploaded: UploadedCardImage;
        try {
          uploaded = await uploadCardImage(file, userId);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed.");
          continue;
        }
        if (itemsRef.current.some((it) => it.path === uploaded.path)) {
          toast.message("That image is already on this card.");
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        setItems((prev) => [
          ...prev,
          {
            ...uploaded,
            alt: "",
            previewUrl,
            local: true,
            status: "describing",
          },
        ]);
        void describe(uploaded.path, uploaded.mime);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function remove(path: string) {
    setItems((prev) => {
      const gone = prev.find((it) => it.path === path);
      if (gone?.local) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((it) => it.path !== path);
    });
  }

  function redo(path: string, mime: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.path === path ? { ...it, status: "describing" } : it,
      ),
    );
    void describe(path, mime);
  }

  function editAlt(path: string, alt: string) {
    setItems((prev) =>
      prev.map((it) => (it.path === path ? { ...it, alt } : it)),
    );
  }

  const { dragging, dragHandlers } = useFileDrop(
    (files) => void onFiles(files),
    busy || !userId,
  );

  const serialised = JSON.stringify(
    items.map(({ path, hash, mime, bytes, alt }) => ({
      path,
      hash,
      mime,
      bytes,
      alt,
    })),
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={serialised} readOnly />

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.path}
              className="border-rule bg-card flex gap-3 rounded-lg border p-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.previewUrl}
                alt={it.alt || "Attached image"}
                className="border-rule size-16 flex-none rounded-md border object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1">
                {it.status === "describing" ? (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Loader2 className="size-3 animate-spin" />
                    Describing the image…
                  </p>
                ) : (
                  <textarea
                    value={it.alt}
                    onChange={(e) => editAlt(it.path, e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder="Description (used for search) — add one if the AI couldn’t"
                    className="border-input bg-background w-full resize-none rounded-md border px-2 py-1 text-xs leading-relaxed"
                  />
                )}
                <div className="text-muted-foreground flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => redo(it.path, it.mime)}
                    disabled={it.status === "describing"}
                    className="hover:text-foreground inline-flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        "size-3",
                        it.status === "describing" && "animate-spin",
                      )}
                    />
                    Redo description
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(it.path)}
                    className="hover:text-clay inline-flex items-center gap-1 transition"
                  >
                    <X className="size-3" /> Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length < MAX_CARD_IMAGES && (
        <>
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <label
            htmlFor={inputId}
            {...dragHandlers}
            className={cn(
              "border-rule text-muted-foreground hover:text-foreground hover:border-foreground/30 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs font-medium transition",
              (busy || !userId) && "pointer-events-none opacity-60",
              dragging &&
                "border-primary bg-ink-tint text-ink border-solid ring-2 ring-[var(--color-ring)]",
            )}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            {dragging
              ? "Drop to add"
              : items.length > 0
                ? "Add another image"
                : "Add an image"}
          </label>
        </>
      )}
    </div>
  );
}
