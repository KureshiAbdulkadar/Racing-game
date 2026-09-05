'use client';

import { useEffect } from 'react';

export default function ResultsRedirectPage() {
  useEffect(() => {
    window.location.replace('/profile');
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
      LOADING RECORDS...
    </div>
  );
}
