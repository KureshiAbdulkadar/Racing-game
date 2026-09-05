'use client';

import { useEffect } from 'react';
import { generateRoomCode } from '@/game/netcode/protocol';

export default function NewRoomPage() {
  useEffect(() => {
    const code = generateRoomCode();
    window.location.href = `/room/${code}`;
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-pixel)',
      fontSize: '14px',
      color: 'var(--accent)',
    }}>
      GENERATING 6-CHARACTER ROOM CODE...
    </div>
  );
}
