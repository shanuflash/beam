"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { generateKey, exportKey, encryptChunk } from "@/lib/crypto";
import { SignalingChannel } from "@/lib/signaling";
import { createPeerConnection } from "@/lib/webrtc";
import type { TransferState, TransferMeta } from "@/lib/types";

const CHUNK_SIZE = 256 * 1024 - 28;
const HIGH_WATERMARK = 8 * 1024 * 1024;
const LOW_WATERMARK = 512 * 1024;

export function useSender() {
  const [state, setState] = useState<TransferState>("idle");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [meta, setMeta] = useState<TransferMeta | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingRef = useRef<SignalingChannel | null>(null);

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

    const sessionId = crypto.randomUUID();
    const key = await generateKey();
    const keyB64 = await exportKey(key);

    const url = `${window.location.origin}/r/${sessionId}#${keyB64}`;
    setShareUrl(url);

    const fileMeta: TransferMeta = {
      name: file.name,
      size: file.size,
      mimeType: file.type,
      totalChunks: Math.ceil(file.size / CHUNK_SIZE),
    };
    setMeta(fileMeta);

    const pc = await createPeerConnection();
    pcRef.current = pc;

    const dc = pc.createDataChannel("beam", { ordered: true });
    dc.bufferedAmountLowThreshold = LOW_WATERMARK;

    dc.onmessage = ({ data }) => {
      if (typeof data === "string") {
        const msg = JSON.parse(data) as { type: string };
        if (msg.type === "received") {
          console.log("[sender] received ack, transfer complete");
          setState("done");
          pc.close();
          signalingRef.current?.destroy();
          signalingRef.current = null;
          pcRef.current = null;
        }
      }
    };

    dc.onopen = async () => {
      console.log("[sender] data channel open");
      setState("sending");
      try {
        dc.send(JSON.stringify({ type: "meta", ...fileMeta }));

        const { totalChunks } = fileMeta;

        const readChunk = async (i: number) => {
          const start = i * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          return new Uint8Array((await file.slice(start, end).arrayBuffer()) as ArrayBuffer);
        };

        let nextEncrypted = readChunk(0).then((c) => encryptChunk(key, c));

        for (let i = 0; i < totalChunks; i++) {
          const encrypted = await nextEncrypted;

          if (i + 1 < totalChunks) {
            nextEncrypted = readChunk(i + 1).then((c) => encryptChunk(key, c));
          }

          if (dc.bufferedAmount > HIGH_WATERMARK) {
            await new Promise<void>((resolve) => {
              const handler = () => {
                dc.removeEventListener("bufferedamountlow", handler);
                resolve();
              };
              dc.addEventListener("bufferedamountlow", handler);
            });
          }

          dc.send(encrypted.buffer);
          setProgress(Math.round(((i + 1) / totalChunks) * 100));
        }

        dc.send(JSON.stringify({ type: "done" }));
        console.log("[sender] all chunks sent, waiting for ack");
      } catch (err) {
        console.error("[sender] send failed", err);
        setState("error");
      }
    };

    const signaling = new SignalingChannel(sessionId, "sender", {
      onReady: async () => {
        console.log("[sender] receiver ready, creating offer");
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await signaling.sendOffer(offer);
          console.log("[sender] offer sent");
        } catch (err) {
          console.error("[sender] offer failed", err);
          setState("error");
        }
      },
      onAnswer: async (sdp) => {
        console.log("[sender] received answer");
        try {
          await pc.setRemoteDescription(sdp);
          console.log("[sender] remote description set");
        } catch (err) {
          console.error("[sender] setRemoteDescription failed", err);
          setState("error");
        }
      },
      onIce: async (candidate) => {
        console.log("[sender] received ICE candidate", candidate);
        try {
          await pc.addIceCandidate(candidate);
        } catch (err) {
          console.warn("[sender] addIceCandidate failed (stale?)", err);
        }
      },
    });
    signalingRef.current = signaling;

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log("[sender] sending ICE candidate", candidate.toJSON());
        signaling.sendIce(candidate.toJSON());
      } else {
        console.log("[sender] ICE gathering complete");
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("[sender] ICE gathering state:", pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[sender] ICE connection state:", pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log("[sender] connection state:", pc.connectionState);
      if (pc.connectionState === "failed") {
        console.error("[sender] connection failed");
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
