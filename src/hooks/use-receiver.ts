"use client";

import { useState, useRef, useEffect } from "react";
import { importKey, decryptChunk } from "@/lib/crypto";
import { SignalingChannel } from "@/lib/signaling";
import { createPeerConnection } from "@/lib/webrtc";
import type { TransferState, TransferMeta } from "@/lib/types";

export function useReceiver(sessionId: string) {
  const keyB64 =
    typeof window !== "undefined" ? window.location.hash.slice(1) : "";
  const [state, setState] = useState<TransferState>(keyB64 ? "idle" : "error");
  const [progress, setProgress] = useState(0);
  const [meta, setMeta] = useState<TransferMeta | null>(null);

  // Refs so event handler closures always see latest values
  const metaRef = useRef<TransferMeta | null>(null);
  const chunksRef = useRef<Uint8Array<ArrayBuffer>[]>([]);
  const receivedRef = useRef(0);

  useEffect(() => {
    if (!keyB64) return;

    let pc: RTCPeerConnection | null = null;
    let signaling: SignalingChannel | null = null;

    const setup = async () => {
      const key = await importKey(keyB64);

      pc = createPeerConnection();

      pc.ondatachannel = ({ channel }) => {
        setState("receiving");

        channel.onmessage = async ({ data }) => {
          if (typeof data === "string") {
            const msg = JSON.parse(data) as { type: string } & TransferMeta;

            if (msg.type === "meta") {
              const m: TransferMeta = {
                name: msg.name,
                size: msg.size,
                mimeType: msg.mimeType,
                totalChunks: msg.totalChunks,
              };
              metaRef.current = m;
              setMeta(m);
            } else if (msg.type === "done") {
              const blob = new Blob(chunksRef.current, {
                type: metaRef.current?.mimeType || "application/octet-stream",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = metaRef.current?.name ?? "beam-file";
              a.click();
              URL.revokeObjectURL(url);
              setState("done");
            }
          } else {
            // Binary: decrypt and collect chunk
            const decrypted = await decryptChunk(
              key,
              new Uint8Array(data as ArrayBuffer),
            );
            chunksRef.current.push(decrypted);
            receivedRef.current++;

            const total = metaRef.current?.totalChunks ?? 1;
            setProgress(Math.round((receivedRef.current / total) * 100));
          }
        };
      };

      signaling = new SignalingChannel(sessionId, "receiver", {
        onOffer: async (sdp) => {
          try {
            await pc!.setRemoteDescription(sdp);
            const answer = await pc!.createAnswer();
            await pc!.setLocalDescription(answer);
            await signaling!.sendAnswer(answer);
            setState((prev) => (prev === "receiving" ? prev : "connected"));
          } catch {
            setState("error");
          }
        },
        onIce: async (candidate) => {
          try {
            await pc!.addIceCandidate(candidate);
          } catch {
            // stale candidate, safe to ignore
          }
        },
      });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) signaling!.sendIce(candidate.toJSON());
      };

      pc.onconnectionstatechange = () => {
        if (pc?.connectionState === "failed") setState("error");
      };

      // Signal sender that receiver is ready to receive offer
      await signaling.sendReady();
      setState("waiting");
    };

    setup().catch(() => setState("error"));

    return () => {
      pc?.close();
      signaling?.destroy();
    };
  }, [sessionId, keyB64]);

  // Warn before closing during an active transfer
  useEffect(() => {
    if (state === "idle" || state === "done" || state === "error") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  return { state, progress, meta };
}
