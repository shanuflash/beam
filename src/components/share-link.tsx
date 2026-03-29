"use client";

import { useState } from "react";
import { Copy, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;

interface ShareLinkProps {
  url: string;
  status: string;
}

export function ShareLink({ url, status }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Label */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Share this link
      </p>

      {/* URL */}
      <div className="rounded-xl border border-white/6 bg-white/3 px-4 py-3.5">
        <p className="break-all font-mono text-sm font-light leading-normal tracking-wide text-foreground/70">
          {url}
        </p>
      </div>

      {/* Copy button */}
      <motion.button
        whileHover={{ scale: 1.02, y: -1, boxShadow: copied ? undefined : "0 4px 32px var(--primary-glow)" }}
        whileTap={{ scale: 0.96 }}
        transition={SPRING}
        onClick={copy}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-[filter] duration-200",
          copied
            ? "bg-green-500/20 text-green-400"
            : "text-primary-foreground hover:brightness-110"
        )}
        style={!copied ? {
          boxShadow: "0 0 20px var(--primary-glow)",
          background: "var(--btn-gradient)",
        } : undefined}
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <motion.span
              key="copied"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              Copied!
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy link
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Status */}
      <div className="flex items-center gap-2.5">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        <p className="text-sm font-light text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}
