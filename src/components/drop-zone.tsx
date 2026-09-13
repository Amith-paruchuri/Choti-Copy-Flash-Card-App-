"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Drag-over state + handlers for dropping files onto an element. Desktop-only
 * in effect — these events never fire on touch, so drag support is purely
 * additive on top of whatever click/tap trigger the element already has.
 */
export function useFileDrop(onFiles: (files: FileList) => void, disabled = false) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave also fire when the pointer crosses child elements.
  const depth = useRef(0);

  function reset() {
    depth.current = 0;
    setDragging(false);
  }

  return {
    dragging: dragging && !disabled,
    dragHandlers: {
      onDragEnter: (e: React.DragEvent) => {
        e.preventDefault();
        if (disabled) return;
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (e: React.DragEvent) => {
        // Required for the drop event to fire.
        e.preventDefault();
        if (!disabled) e.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: (e: React.DragEvent) => {
        e.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) reset();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        reset();
        if (disabled) return;
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      },
    },
  };
}

/**
 * Click-to-browse file picker that also accepts a file dragged from the
 * desktop. Drag-and-drop is additive — tapping still works everywhere,
 * including on phones where drag events never fire.
 */
export function DropZone({
  onFile,
  accept,
  disabled = false,
  label,
  hint,
  icon,
}: {
  onFile: (file: File) => void;
  /** `accept` attribute for the file dialog (drops are validated by `onFile`). */
  accept: string;
  disabled?: boolean;
  label: ReactNode;
  hint: ReactNode;
  icon: ReactNode;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { dragging, dragHandlers } = useFileDrop(
    (files) => onFile(files[0]),
    disabled,
  );

  return (
    <label
      htmlFor={inputId}
      aria-disabled={disabled}
      {...dragHandlers}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center transition",
        disabled
          ? "border-border cursor-default opacity-70"
          : "border-border hover:bg-muted/40 cursor-pointer",
        dragging &&
          !disabled &&
          "border-primary bg-ink-tint border-solid ring-2 ring-[var(--color-ring)]",
      )}
    >
      <span
        className={cn(
          "transition-colors",
          dragging && !disabled ? "text-ink" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">
        {dragging && !disabled ? "Drop to upload" : label}
      </span>
      <span className="text-muted-foreground text-xs">
        {hint}
        <span className="hidden sm:inline"> · or drop a file here</span>
      </span>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </label>
  );
}
