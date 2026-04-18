const STUN_ONLY: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/turn");
    if (!res.ok) throw new Error();
    const servers = await res.json() as RTCIceServer[];
    return servers.length ? servers : STUN_ONLY;
  } catch {
    return STUN_ONLY;
  }
}

export async function createPeerConnection(): Promise<RTCPeerConnection> {
  const iceServers = await fetchIceServers();
  return new RTCPeerConnection({ iceServers });
}
