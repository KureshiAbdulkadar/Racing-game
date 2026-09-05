import { NextResponse } from 'next/server';
import { generateRoomCode } from '../../../game/netcode/protocol';

export async function POST(req: Request) {
  try {
    const code = generateRoomCode();
    const hostToken = 'token-' + Math.random().toString(36).substring(2, 10);
    return NextResponse.json({
      code,
      hostToken,
      wsUrl: `ws://localhost:3001`,
      status: 'waiting',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    version: '0.1.0',
    serverTime: new Date().toISOString(),
  });
}
