"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSender } from "@/hooks/use-sender";
import { FileDropzone } from "@/components/file-dropzone";
import { ShareLink } from "@/components/share-link";
import { TransferProgress } from "@/components/transfer-progress";

const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;

const panel = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

const SENDER_STATUS: Record<string, string> = {
  waiting: "Waiting for receiver to open the link...",
  connected: "Receiver connected — starting transfer...",
};

export default function Home() {
  const { state, shareUrl, progress, meta, startTransfer, reset } = useSender();
  const [dragActive, setDragActive] = useState(false);
  const onDragActiveChange = useCallback(
    (active: boolean) => setDragActive(active),
    [],
  );

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-10 px-4 py-16">
      {/* Ambient background mesh glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
        aria-hidden
        style={{
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background:
            state === "done"
              ? "radial-gradient(circle, rgba(74, 222, 128, 0.07) 0%, transparent 70%)"
              : "radial-gradient(circle, oklch(0.45 0.085 224.283 / 0.07) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.09 } },
        }}
        className="flex flex-col items-center gap-2 text-center"
      >
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: SPRING },
          }}
          className="flex items-center gap-2.5"
        >
          <motion.div
            animate={{ rotate: [0, -15, 15, 0] }}
            transition={{ delay: 0.6, duration: 0.5, ease: "easeInOut" }}
          >
            <Zap className="h-6 w-6 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-semibold tracking-tight">beam</h1>
        </motion.div>
        <motion.p
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: SPRING },
          }}
          className="text-sm font-medium text-muted-foreground/90"
        >
          peer-to-peer <span className="text-primary">·</span> zero servers{" "}
          <span className="text-primary">·</span> always encrypted
        </motion.p>
      </motion.div>

      {/* Persistent card */}
      <div
        className={cn(
          "relative w-full max-w-sm rounded-2xl border bg-card p-6 transition-colors duration-200",
          dragActive ? "border-primary/40 bg-primary/2" : "border-white/8",
        )}
        style={{
          boxShadow:
            "var(--card-shadow), inset 0 1px 0 0 rgba(255,255,255,0.06)",
        }}
      >
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div key="idle" {...panel}>
              <FileDropzone
                onFile={startTransfer}
                onDragActiveChange={onDragActiveChange}
              />
            </motion.div>
          )}

          {(state === "waiting" || state === "connected") && shareUrl && (
            <motion.div key="share" {...panel}>
              <ShareLink url={shareUrl} status={SENDER_STATUS[state] ?? ""} />
            </motion.div>
          )}

          {state === "sending" && meta && (
            <motion.div key="sending" {...panel}>
              <TransferProgress
                meta={meta}
                progress={progress}
                label="Encrypting & sending..."
              />
            </motion.div>
          )}

          {state === "done" && (
            <motion.div
              key="done"
              {...panel}
              className="flex flex-col items-center gap-5 py-6 text-center"
            >
              <div className="relative flex h-16 w-16 items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "rgba(74, 222, 128, 0.1)" }}
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.8,
                    ease: "easeOut",
                  }}
                />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-green-400/20 bg-green-400/10">
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ ...SPRING, delay: 0.1 }}
                  >
                    <CheckCircle className="h-8 w-8 text-green-400" />
                  </motion.div>
                </div>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Transfer complete
                </p>
                <p className="mt-1 text-sm font-light text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {meta?.name}
                  </span>{" "}
                  was delivered securely
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                onClick={reset}
                className="rounded-xl bg-muted px-5 py-2.5 text-sm font-medium text-muted-foreground transition-[filter] duration-200 hover:bg-muted/80 hover:brightness-125"
              >
                Send another file
              </motion.button>
            </motion.div>
          )}

          {state === "error" && (
            <motion.div
              key="error"
              {...panel}
              className="flex flex-col items-center gap-5 py-6 text-center"
            >
              <motion.div
                animate={{ x: [-6, 6, -4, 4, 0] }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15"
              >
                <AlertCircle className="h-8 w-8 text-destructive" />
              </motion.div>
              <div>
                <p className="font-semibold text-foreground">
                  Connection failed
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  The receiver&apos;s connection dropped. Try sharing a new
                  link.
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                onClick={reset}
                className="rounded-xl bg-muted px-5 py-2.5 text-sm font-medium text-muted-foreground transition-[filter] duration-200 hover:bg-muted/80 hover:brightness-125"
              >
                Try again
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
