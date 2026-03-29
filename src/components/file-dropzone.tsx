"use client";

import { useState, useRef, useEffect, useCallback, DragEvent } from "react";
import { Upload, FileText, ArrowRight, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, formatBytes } from "@/lib/utils";

const MAX_SIZE = 1024 * 1024 * 1024;
const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;

interface FileDropzoneProps {
  onFile: (file: File) => void;
  onDragActiveChange?: (active: boolean) => void;
}

export function FileDropzone({ onFile, onDragActiveChange }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveringBeam, setHoveringBeam] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Window-level drag detection so the card reacts as soon as
  // a file enters the browser window, not just the dropzone.
  const setDragActive = useCallback((active: boolean) => {
    setDragging(active);
    onDragActiveChange?.(active);
  }, [onDragActiveChange]);

  useEffect(() => {
    const onEnter = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (dragCounter.current === 1) setDragActive(true);
    };
    const onLeave = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setDragActive(false); }
    };
    const onDrop = (e: globalThis.DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDragActive(false);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [setDragActive]);

  const handleFile = (file: File) => {
    if (file.size > MAX_SIZE) {
      setError("File must be under 1 GB");
      return;
    }
    setError(null);
    setSelected(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className="flex flex-col gap-4"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key="selected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: SPRING }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            className="relative flex flex-col items-center gap-4 py-6 text-center"
          >
            {/* Remove / change file */}
            <button
              onClick={(e) => { e.stopPropagation(); setSelected(null); inputRef.current!.value = ""; }}
              className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-white/8 hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* File icon */}
            <motion.div
              initial={{ scale: 0.8, rotate: -8 }}
              animate={{ scale: 1, rotate: 0, transition: SPRING }}
              className="relative flex items-center justify-center"
            >
              {/* Soft ambient glow */}
              <div
                className="absolute h-28 w-28 rounded-full"
                style={{
                  background: "radial-gradient(circle, oklch(0.45 0.085 224.283 / 0.12) 0%, transparent 70%)",
                }}
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-primary/10 bg-primary/8">
                <FileText className="h-7 w-7 text-primary" />
              </div>
            </motion.div>

            {/* File info */}
            <div>
              <p className="max-w-56 truncate font-semibold text-foreground">{selected.name}</p>
              <p className="mt-1 text-sm font-light text-muted-foreground">{formatBytes(selected.size)}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: SPRING }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-5 rounded-xl py-6 text-center transition-colors duration-200",
              dragging && "bg-primary/4"
            )}
            style={{
              border: dragging
                ? "2px dashed oklch(0.45 0.085 224.283 / 0.5)"
                : "2px dashed rgba(255,255,255,0.04)",
            }}
          >
            {/* Icon with ambient glow */}
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute h-24 w-24 rounded-full blur-2xl"
                style={{
                  background: "radial-gradient(circle, oklch(0.45 0.085 224.283 / 0.35) 0%, oklch(0.45 0.085 224.283 / 0.1) 50%, transparent 70%)",
                  mixBlendMode: "screen",
                }}
                animate={
                  dragging
                    ? { scale: 1.6, opacity: 1 }
                    : { scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }
                }
                transition={
                  dragging
                    ? SPRING
                    : { repeat: Infinity, duration: 3, ease: "easeInOut" }
                }
              />
              <motion.div
                animate={dragging ? { scale: 1.1, y: -4 } : { y: [0, -4, 0] }}
                transition={
                  dragging
                    ? SPRING
                    : { repeat: Infinity, duration: 2.5, ease: "easeInOut" }
                }
                className={cn(
                  "relative flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
                  dragging ? "bg-primary/20" : "bg-muted"
                )}
              >
                <Upload
                  className={cn(
                    "h-6 w-6 transition-colors",
                    dragging ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </motion.div>
            </div>

            {/* Text */}
            <div className="flex flex-col gap-1">
              <p
                className="text-base font-semibold text-foreground"
              >
                {dragging ? "Drop it here" : "Drop a file to send"}
              </p>
              <p className="text-sm font-light text-muted-foreground">
                or <span className="font-normal text-foreground/70 underline underline-offset-2">click to browse</span> · up to 1 GB
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-center text-sm text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.button
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            whileHover={{ scale: 1.02, y: -1, boxShadow: "0 4px 32px var(--primary-glow)" }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            onClick={() => onFile(selected)}
            onHoverStart={() => setHoveringBeam(true)}
            onHoverEnd={() => setHoveringBeam(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-primary-foreground transition-[filter] duration-200 hover:brightness-110"
            style={{
              background: "var(--btn-gradient)",
            }}
          >
            Beam it
            <motion.span
              animate={{ x: hoveringBeam ? 4 : 0 }}
              transition={SPRING}
              className="inline-flex"
            >
              <ArrowRight className="h-4 w-4" />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
