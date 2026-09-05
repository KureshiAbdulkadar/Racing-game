'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import confetti from 'canvas-confetti';
import { getUserProfile, UserProfile } from '@/db/storage';
import { getSoundEngine } from '@/game/engine/audio';
import { getTrack } from '@/game/tracks/track-data';

export default function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ pos?: string; time?: string; best?: string; track?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearch = use(searchParams);

  const pos = parseInt(resolvedSearch.pos || '1', 10);
  const totalTime = resolvedSearch.time || '0.00';
  const bestLap = resolvedSearch.best || '0.00';
  const trackId = resolvedSearch.track || 'neon-circuit';
  const track = getTrack(trackId);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const prof = getUserProfile();
    setProfile(prof);

    // Audio & Confetti
    const sound = getSoundEngine();
    sound.unlock();
    sound.startRetroMusic('victory');

    if (pos <= 3) {
      try {
        confetti({
          particleCount: pos === 1 ? 120 : 60,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#00E5FF', '#FF00A8', '#FFEA00', '#FFFFFF'],
        });
      } catch (e) {}
    }

    return () => {
      sound.stopMusic();
    };
  }, [pos]);

  const posSuffix = pos === 1 ? 'ST' : pos === 2 ? 'ND' : pos === 3 ? 'RD' : 'TH';
  const xpAwarded = 100 + (pos === 1 ? 150 : pos === 2 ? 80 : pos === 3 ? 40 : 10);

  const handleRematch = () => {
    window.location.href = `/race/solo?track=${trackId}&laps=${track.lapsDefault}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        padding: '40px 20px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#AAA', marginBottom: '8px' }}>
            {track.name.toUpperCase()} • {track.lapsDefault} LAPS COMPLETED
          </div>
          <h1 className="pixel-title glow-pulse" style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            color: pos === 1 ? '#FFEA00' : pos <= 3 ? '#00E5FF' : '#FFF',
          }}>
            {pos === 1 ? 'VICTORY!' : pos <= 3 ? 'PODIUM FINISH!' : 'RACE COMPLETED!'}
          </h1>
        </div>

        {/* Podium Card */}
        <div className="arcade-card arcade-card-glow" style={{ width: '100%', maxWidth: '580px', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: 'rgba(0, 0, 0, 0.4)',
            border: '2px solid ' + (pos === 1 ? '#FFEA00' : 'var(--accent)'),
            borderRadius: '4px',
            marginBottom: '24px',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', color: pos === 1 ? '#FFEA00' : '#00E5FF' }}>
              {pos}{posSuffix} PLACE
            </span>
          </div>

          {/* Stats Breakdown Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
            borderTop: '1px solid var(--border)',
            borderBottom: '1px solid var(--border)',
            padding: '20px 0',
            marginBottom: '24px',
          }}>
            <div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '6px' }}>
                TOTAL TIME
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 'bold', color: '#FFF' }}>
                {totalTime}s
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '6px' }}>
                BEST LAP
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 'bold', color: 'var(--accent)' }}>
                {bestLap}s
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '6px' }}>
                XP EARNED
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 'bold', color: '#00FF44' }}>
                +{xpAwarded} XP
              </div>
            </div>
          </div>

          {/* Player Level & XP Progress */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '10px', marginBottom: '6px' }}>
              <span>LEVEL {profile?.level || 1}</span>
              <span style={{ color: 'var(--accent)' }}>{profile?.xp || 0} TOTAL XP</span>
            </div>
            <div style={{ height: '10px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (((profile?.xp || 0) % 300) / 300) * 100)}%`,
                background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
              }} />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={handleRematch} className="btn-arcade" style={{ padding: '14px 28px' }}>
            🔄 REMATCH
          </button>
          <a href="/customize" className="btn-arcade btn-arcade-secondary" style={{ padding: '14px 24px' }}>
            ⚙ GARAGE
          </a>
          <a href="/play" className="btn-arcade btn-arcade-ghost" style={{ padding: '14px 24px' }}>
            BACK TO LOBBY
          </a>
        </div>
      </main>
    </div>
  );
}
