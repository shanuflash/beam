import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch(
    `https://shanu.metered.live/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`,
  );

  if (!res.ok) return NextResponse.json([], { status: 502 });

  const iceServers = await res.json();
  return NextResponse.json(iceServers);
}
