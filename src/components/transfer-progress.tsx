"use client";

import { FileText } from "lucide-react";
import {
  motion,
  useSpring,
  useTransform,
  useMotionValue,
  animate,
} from "framer-motion";
import { useEffect } from "react";
import { formatBytes } from "@/lib/utils";
import type { TransferMeta } from "@/lib/types";

const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;

interface TransferProgressProps {
  meta: TransferMeta;
  progress: number;
  label: string;
}

export function TransferProgress({
  meta,
  progress,
  label,
}: TransferProgressProps) {
  const raw = useMotionValue(0);
  const display = useTransform(raw, (v) => `${Math.round(v)}%`);
  const springWidth = useSpring(0, { stiffness: 80, damping: 20 });

  useEffect(() => {
    animate(raw, progress, { duration: 0.4, ease: "easeOut" });
    springWidth.set(progress);
  }, [progress, raw, springWidth]);

  return (
    <div className="flex flex-col gap-5">
      {/* File info */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-primary/8">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {meta.name}
          </p>
          <p className="text-xs font-light text-muted-foreground">
            {formatBytes(meta.size)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className="relative h-full rounded-full bg-primary"
          style={{
            width: useTransform(springWidth, (v) => `${v}%`),
            boxShadow:
              "0 0 12px var(--primary-glow), 0 0 4px var(--primary-glow)",
          }}
        >
          {/* Shimmer overlay */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)",
              animation: "shimmer 1.8s ease-in-out infinite",
            }}
          />
        </motion.div>
      </div>

      {/* Label + percentage */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-light text-muted-foreground">{label}</p>
        <motion.span
          className="font-mono text-sm font-semibold tabular-nums text-primary"
          transition={SPRING}
        >
          {display}
        </motion.span>
      </div>
    </div>
  );
}
