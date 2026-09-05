import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const resolved = await params;
  const code = resolved.code.toUpperCase();

  return NextResponse.json({
    code,
    status: 'waiting',
    trackId: 'neon-circuit',
    laps: 3,
    maxPlayers: 8,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const resolved = await params;
  const code = resolved.code.toUpperCase();
  const playerToken = 'player-' + Math.random().toString(36).substring(2, 10);

  return NextResponse.json({
    code,
    playerToken,
    wsUrl: `ws://localhost:3001`,
    status: 'joined',
  });
}
