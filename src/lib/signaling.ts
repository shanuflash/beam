import Ably from "ably";

export type SignalingRole = "sender" | "receiver";

export interface SignalingCallbacks {
  onReady?: () => void;
  onOffer?: (sdp: RTCSessionDescriptionInit) => void;
  onAnswer?: (sdp: RTCSessionDescriptionInit) => void;
  onIce?: (candidate: RTCIceCandidateInit) => void;
}

export class SignalingChannel {
  private realtime: Ably.Realtime;
  private channel: Ably.RealtimeChannel;
  private clientId: string;

  constructor(
    sessionId: string,
    role: SignalingRole,
    callbacks: SignalingCallbacks
  ) {
    this.clientId = `${role}-${sessionId}`;
    this.realtime = new Ably.Realtime({
      clientId: this.clientId,
      authUrl: `/api/ably?clientId=${encodeURIComponent(this.clientId)}`,
    });
    this.channel = this.realtime.channels.get(`beam:${sessionId}`);

    if (callbacks.onReady) {
      this.channel.subscribe("ready", () => callbacks.onReady!());
    }
    if (callbacks.onOffer) {
      this.channel.subscribe("offer", (msg) => callbacks.onOffer!(msg.data));
    }
    if (callbacks.onAnswer) {
      this.channel.subscribe("answer", (msg) => callbacks.onAnswer!(msg.data));
    }
    if (callbacks.onIce) {
      // Filter out own messages — Ably echoes published messages back to the publisher
      this.channel.subscribe("ice", (msg) => {
        if (msg.clientId !== this.clientId) callbacks.onIce!(msg.data);
      });
    }
  }

  sendReady() {
    return this.channel.publish("ready", null);
  }

  sendOffer(sdp: RTCSessionDescriptionInit) {
    return this.channel.publish("offer", sdp);
  }

  sendAnswer(sdp: RTCSessionDescriptionInit) {
    return this.channel.publish("answer", sdp);
  }

  sendIce(candidate: RTCIceCandidateInit) {
    return this.channel.publish("ice", candidate);
  }

  destroy() {
    this.channel.detach();
    this.realtime.close();
  }
}
