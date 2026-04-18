"use client";

import { useState, useRef, useEffect } from "react";
import { importKey, decryptChunk } from "@/lib/crypto";
import { SignalingChannel } from "@/lib/signaling";
import { createPeerConnection } from "@/lib/webrtc";
import type { TransferState, TransferMeta } from "@/lib/types";

export function useReceiver(sessionId: string) {
  const [state, setState] = useState<TransferState>(() =>
    typeof window !== "undefined" && !window.location.hash.slice(1)
      ? "error"
      : "idle"
  );
  const [progress, setProgress] = useState(0);
  const [meta, setMeta] = useState<TransferMeta | null>(null);

  const metaRef = useRef<TransferMeta | null>(null);
  const chunksRef = useRef<Uint8Array<ArrayBuffer>[]>([]);
  const receivedRef = useRef(0);

  useEffect(() => {
    const keyB64 = window.location.hash.slice(1);
    if (!keyB64) return;

    let pc: RTCPeerConnection | null = null;
    let signaling: SignalingChannel | null = null;

    let offerTimeout: ReturnType<typeof setTimeout> | undefined;

    const teardown = () => {
      clearTimeout(offerTimeout);
      pc?.close();
      pc = null;
      // Don't explicitly destroy signaling — if the sender already closed the
      // connection, calling realtime.close() here throws an unhandled rejection.
      // Ably cleans up automatically when the underlying connection drops.
      signaling = null;
    };

    const setup = async () => {
      const key = await importKey(keyB64);

      pc = createPeerConnection();

      pc.ondatachannel = ({ channel }) => {
        console.log("[receiver] data channel open");
        setState("receiving");

        let decryptQueue = Promise.resolve();

        channel.onmessage = ({ data }) => {
          decryptQueue = decryptQueue.then(async () => {
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
                channel.send(JSON.stringify({ type: "received" }));
                setState("done");
                setTimeout(teardown, 0);
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
          }).catch((err) => {
            console.error("[receiver] decrypt queue error", err);
            setState("error");
          });
        };
      };

      signaling = new SignalingChannel(sessionId, "receiver", {
        onOffer: async (sdp) => {
          console.log("[receiver] received offer");
          clearTimeout(offerTimeout);
          try {
            await pc!.setRemoteDescription(sdp);
            const answer = await pc!.createAnswer();
            await pc!.setLocalDescription(answer);
            await signaling!.sendAnswer(answer);
            console.log("[receiver] answer sent");
            setState((prev) =>
              prev === "waiting" || prev === "idle" ? "connected" : prev
            );
          } catch (err) {
            console.error("[receiver] offer handling failed", err);
            setState("error");
          }
        },
        onIce: async (candidate) => {
          console.log("[receiver] received ICE candidate", candidate);
          try {
            await pc!.addIceCandidate(candidate);
          } catch (err) {
            console.warn("[receiver] addIceCandidate failed (stale?)", err);
          }
        },
      });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log("[receiver] sending ICE candidate", candidate.toJSON());
          signaling!.sendIce(candidate.toJSON());
        } else {
          console.log("[receiver] ICE gathering complete");
        }
      };

      pc.onicegatheringstatechange = () => {
        console.log("[receiver] ICE gathering state:", pc!.iceGatheringState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("[receiver] ICE connection state:", pc!.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log("[receiver] connection state:", pc!.connectionState);
        if (pc?.connectionState === "failed") {
          console.error("[receiver] connection failed");
          setState("error");
        }
      };

      await signaling.waitForAttach();
      console.log("[receiver] signaling attached, sending ready");
      await signaling.sendReady();
      setState("waiting");

      offerTimeout = setTimeout(() => {
        console.warn("[receiver] offer timeout — link expired or invalid");
        setState("error");
      }, 10_000);
    };

    setup().catch(() => setState("error"));

    return () => teardown();
  }, [sessionId]);

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
