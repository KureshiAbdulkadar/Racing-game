'use client';

import { useEffect } from 'react';

export default function RaceRedirectPage() {
  useEffect(() => {
    window.location.replace('/race/solo');
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
      background: 'var(--bg-0)',
    }}>
      STARTING RACE...
    </div>
  );
}
