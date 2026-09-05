'use client';

import React from 'react';
import Navbar from '../components/Navbar';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '32px 20px',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '6rem',
          color: 'var(--danger)',
          lineHeight: '1',
          marginBottom: '12px',
          textShadow: '0 0 20px var(--danger)',
        }}>
          404
        </div>

        <h1 className="pixel-title" style={{ fontSize: '20px', color: '#FFF', marginBottom: '16px' }}>
          OFF-ROAD! TRACK NOT FOUND
        </h1>

        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '14px',
          color: '#888',
          maxWidth: '450px',
          marginBottom: '32px',
          lineHeight: '1.6',
        }}>
          You took a wrong turn and drove off the circuit. Return to the starting grid or choose a game mode.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="/" className="btn-arcade" style={{ padding: '14px 28px' }}>
            🏁 RETURN TO START
          </a>
          <a href="/play" className="btn-arcade btn-arcade-secondary" style={{ padding: '14px 28px' }}>
            🏎 GO TO RACE MODES
          </a>
        </div>
      </main>
    </div>
  );
}
