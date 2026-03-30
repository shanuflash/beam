"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { generateKey, exportKey, encryptChunk } from "@/lib/crypto";
import { SignalingChannel } from "@/lib/signaling";
import { createPeerConnection } from "@/lib/webrtc";
import type { TransferState, TransferMeta } from "@/lib/types";

const CHUNK_SIZE = 256 * 1024; // 256 KB per DataChannel message
const HIGH_WATERMARK = 8 * 1024 * 1024; // pause sending above 8 MB buffered
const LOW_WATERMARK = 512 * 1024; // resume when buffer drains to 512 KB

export function useSender() {
  const [state, setState] = useState<TransferState>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [meta, setMeta] = useState<TransferMeta | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<SignalingChannel | null>(null);

  // Warn before closing during an active transfer
  useEffect(() => {
    if (state === "idle" || state === "done" || state === "error") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  const startTransfer = useCallback(async (file: File) => {
    setState("waiting");

    // Generate session ID and AES-256-GCM key
    const sessionId = crypto.randomUUID();
    const key = await generateKey();
    const keyB64 = await exportKey(key);

    // Key goes in the fragment — never sent to server
    const url = `${window.location.origin}/r/${sessionId}#${keyB64}`;
    setShareUrl(url);

    const fileMeta: TransferMeta = {
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
    };
    setMeta(fileMeta);

    const pc = createPeerConnection();
    pcRef.current = pc;

    const dc = pc.createDataChannel("beam", { ordered: true });
    dc.bufferedAmountLowThreshold = LOW_WATERMARK;

    dc.onopen = async () => {
      setState("sending");
      try {
        dc.send(JSON.stringify({ type: "meta", ...fileMeta }));

        const { totalChunks } = fileMeta;

        const readChunk = async (i: number): Promise<Uint8Array<ArrayBuffer>> => {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          return new Uint8Array((await file.slice(start, end).arrayBuffer()) as ArrayBuffer);
        };

        const waitForDrain = () =>
          new Promise<void>((resolve) => {
            const handler = () => {
              dc.removeEventListener("bufferedamountlow", handler);
              resolve();
            };
            dc.addEventListener("bufferedamountlow", handler);
          });

        // Pipeline: encrypt chunk N+1 while chunk N is in-flight
        let nextEncrypted = encryptChunk(key, await readChunk(0));
        let lastPct = 0;

        for (let i = 0; i < totalChunks; i++) {
          const encrypted = await nextEncrypted;

          // Kick off next read+encrypt before blocking on backpressure
          if (i + 1 < totalChunks) {
            nextEncrypted = readChunk(i + 1).then((c) => encryptChunk(key, c));
          }

          if (dc.bufferedAmount > HIGH_WATERMARK) await waitForDrain();

          dc.send(encrypted.buffer);

          // Only re-render when the displayed integer % actually changes
          const pct = Math.round(((i + 1) / totalChunks) * 100);
          if (pct !== lastPct) {
            lastPct = pct;
            setProgress(pct);
          }
        }

        dc.send(JSON.stringify({ type: "done" }));
        setState("done");
      } catch {
        setState("error");
      }
    };

    // Signaling: wait for receiver "ready" before creating offer
    const signaling = new SignalingChannel(sessionId, "sender", {
      onReady: async () => {
        setState("connected");
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signaling.sendOffer(offer);
        } catch {
          setState("error");
        }
      },
      onAnswer: async (sdp) => {
        try {
          await pc.setRemoteDescription(sdp);
        } catch {
          setState("error");
        }
      },
      onIce: async (candidate) => {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // stale candidate, safe to ignore
        }
      },
    });
    signalingRef.current = signaling;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) signaling.sendIce(candidate.toJSON());
    };

    pc.onconnectionstatechange = () => {
      const { connectionState } = pc;
      if (connectionState === "failed" || connectionState === "disconnected") {
        setState("error");
      }
    };
  }, []);

  const reset = useCallback(() => {
    pcRef.current?.close();
    signalingRef.current?.destroy();
    pcRef.current = null;
    signalingRef.current = null;
    setState("idle");
    setShareUrl(null);
    setProgress(0);
    setMeta(null);
  }, []);

  return { state, shareUrl, progress, meta, startTransfer, reset };
}
