'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUserProfile, UserProfile } from '@/db/storage';
import { getSoundEngine } from '@/game/engine/audio';

export default function Navbar() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  const toggleMute = () => {
    const sound = getSoundEngine();
    sound.unlock();
    if (isAudioMuted) {
      sound.setMasterVolume(0.8);
      setIsAudioMuted(false);
    } else {
      sound.setMasterVolume(0);
      setIsAudioMuted(true);
    }
  };

  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '2px solid var(--border)',
      background: 'rgba(10, 10, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'relative',
      zIndex: 100,
    }}>
      <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
          clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0% 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 'bold',
          color: '#000',
          fontFamily: 'var(--font-pixel)',
          fontSize: '14px',
        }}>
          PR
        </div>
        <span className="pixel-title" style={{ fontSize: '18px', color: '#FFF' }}>
          PIXEL RACER
        </span>
      </a>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <a href="/play" className="btn-arcade" style={{ padding: '8px 16px', fontSize: '11px' }}>
          RACE
        </a>
        <a href="/customize" className="btn-arcade btn-arcade-secondary" style={{ padding: '8px 16px', fontSize: '11px' }}>
          GARAGE
        </a>
        <a href="/profile" style={{
          textDecoration: 'none',
          color: 'var(--text)',
          fontFamily: 'var(--font-pixel)',
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
        }}>
          <span>LVL {profile?.level || 1}</span>
          <span style={{ color: 'var(--accent)' }}>★</span>
        </a>
        <a href="/settings" style={{
          textDecoration: 'none',
          color: '#AAA',
          fontFamily: 'var(--font-pixel)',
          fontSize: '11px',
        }}>
          SETTINGS
        </a>
        <button
          onClick={toggleMute}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: isAudioMuted ? 'var(--danger)' : 'var(--accent)',
            fontFamily: 'var(--font-pixel)',
            fontSize: '10px',
            padding: '6px 10px',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
          title="Toggle Sound"
        >
          {isAudioMuted ? 'MUTE' : 'AUDIO ON'}
        </button>
      </nav>
    </header>
  );
}
