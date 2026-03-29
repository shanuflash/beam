"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Zap, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useReceiver } from "@/hooks/use-receiver";
import { TransferProgress } from "@/components/transfer-progress";

const SPRING = { type: "spring", stiffness: 400, damping: 28 } as const;

const panel = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

const RECEIVER_STATUS: Record<string, string> = {
  idle: "Initialising...",
  waiting: "Waiting for sender...",
  connected: "Sender connected — preparing...",
  receiving: "File incoming...",
};

interface ReceiverViewProps {
  sessionId: string;
}

export function ReceiverView({ sessionId }: ReceiverViewProps) {
  const { state, progress, meta } = useReceiver(sessionId);

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
          <Zap className="h-6 w-6 text-primary" />
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
        className="relative w-full max-w-sm rounded-2xl border border-white/8 bg-card p-6"
        style={{
          boxShadow:
            "var(--card-shadow), inset 0 1px 0 0 rgba(255,255,255,0.06)",
        }}
      >
        <AnimatePresence mode="wait">
          {(state === "idle" ||
            state === "waiting" ||
            state === "connected" ||
            (state === "receiving" && !meta)) && (
            <motion.div
              key="waiting"
              {...panel}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-light text-muted-foreground">
                {RECEIVER_STATUS[state] ?? "Connecting..."}
              </p>
            </motion.div>
          )}

          {state === "receiving" && meta && (
            <motion.div key="receiving" {...panel}>
              <TransferProgress
                meta={meta}
                progress={progress}
                label="Receiving & decrypting..."
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
                  Download complete
                </p>
                <p className="mt-1 text-sm font-light text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {meta?.name}
                  </span>{" "}
                  was decrypted and saved
                </p>
              </div>
              <motion.a
                href="/"
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                transition={SPRING}
                className="rounded-xl bg-muted px-5 py-2.5 text-sm font-medium text-muted-foreground transition-[filter] duration-200 hover:bg-muted/80 hover:brightness-125"
              >
                Receive another file
              </motion.a>
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
                <p className="mt-1 max-w-xs text-sm font-light text-muted-foreground">
                  The link may be invalid or the sender&apos;s connection
                  dropped. Ask for a new link.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
