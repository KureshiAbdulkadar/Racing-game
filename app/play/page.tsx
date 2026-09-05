'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { ALL_TRACKS } from '@/game/tracks/track-data';
import { getSoundEngine } from '@/game/engine/audio';

export default function PlayModePage() {
  const [mode, setMode] = useState<'solo' | 'friends'>('solo');
  const [selectedTrack, setSelectedTrack] = useState('neon-circuit');
  const [aiCount, setAiCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<'rookie' | 'pro' | 'legend'>('pro');
  const [laps, setLaps] = useState(3);
  const [joinCode, setJoinCode] = useState('');

  const handleStartSolo = () => {
    const sound = getSoundEngine();
    sound.unlock();
    sound.playBoost();
    window.location.href = `/race/solo?track=${selectedTrack}&bots=${aiCount}&diff=${aiDifficulty}&laps=${laps}`;
  };

  const handleCreateRoom = () => {
    const sound = getSoundEngine();
    sound.unlock();
    window.location.href = '/room/new';
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const sound = getSoundEngine();
    sound.unlock();
    window.location.href = `/room/${joinCode.trim().toUpperCase()}`;
  };

  const currentTrack = ALL_TRACKS[selectedTrack] || ALL_TRACKS['neon-circuit'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        padding: '32px 20px',
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 className="pixel-title" style={{ fontSize: '28px', color: '#FFF', marginBottom: '8px' }}>
            SELECT GAME MODE
          </h1>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#A0A0B0' }}>
            SOLO AGAINST ADAPTIVE AI OR INSTANT MULTIPLAYER ROOMS
          </p>

          {/* Mode Switcher Tabs */}
          <div style={{ display: 'inline-flex', gap: '16px', marginTop: '20px' }}>
            <button
              onClick={() => setMode('solo')}
              className={`btn-arcade ${mode === 'solo' ? '' : 'btn-arcade-ghost'}`}
              style={{ padding: '12px 28px', fontSize: '12px' }}
            >
              🏁 QUICK RACE (SOLO)
            </button>
            <button
              onClick={() => setMode('friends')}
              className={`btn-arcade btn-arcade-secondary ${mode === 'friends' ? '' : 'btn-arcade-ghost'}`}
              style={{ padding: '12px 28px', fontSize: '12px' }}
            >
              👥 PLAY WITH FRIENDS
            </button>
          </div>
        </div>

        {mode === 'solo' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Track Selector Card */}
            <div className="arcade-card">
              <div style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '12px',
                color: 'var(--accent)',
                marginBottom: '16px',
              }}>
                1. SELECT CIRCUIT
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.values(ALL_TRACKS).map((trk) => {
                  const isSelected = selectedTrack === trk.id;
                  return (
                    <div
                      key={trk.id}
                      onClick={() => setSelectedTrack(trk.id)}
                      style={{
                        padding: '16px',
                        background: isSelected ? 'rgba(0, 229, 255, 0.15)' : 'var(--bg-1)',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: '#FFF', marginBottom: '4px' }}>
                          {trk.name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#AAA' }}>
                          Length: {trk.lapLengthMeters}m • Difficulty: {'★'.repeat(trk.difficulty)}
                        </div>
                      </div>
                      <span style={{
                        color: isSelected ? 'var(--accent)' : '#555',
                        fontFamily: 'var(--font-pixel)',
                        fontSize: '14px',
                      }}>
                        {isSelected ? '▶' : '○'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Race Config Card */}
            <div className="arcade-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '12px',
                  color: 'var(--accent-2)',
                  marginBottom: '16px',
                }}>
                  2. RACE SETTINGS
                </div>

                {/* AI Bots count */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                    AI OPPONENTS: {aiCount} RACERS
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={aiCount}
                    onChange={(e) => setAiCount(parseInt(e.target.value, 10))}
                    style={{ width: '100%', accentColor: 'var(--accent-2)' }}
                  />
                </div>

                {/* AI Difficulty */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                    AI SKILL TIER
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['rookie', 'pro', 'legend'] as const).map((tier) => (
                      <button
                        key={tier}
                        onClick={() => setAiDifficulty(tier)}
                        className={`btn-arcade ${aiDifficulty === tier ? '' : 'btn-arcade-ghost'}`}
                        style={{ flex: 1, padding: '8px', fontSize: '10px' }}
                      >
                        {tier.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lap Count */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                    LAPS: {laps} LAPS
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 5].map((l) => (
                      <button
                        key={l}
                        onClick={() => setLaps(l)}
                        className={`btn-arcade ${laps === l ? 'btn-arcade-secondary' : 'btn-arcade-ghost'}`}
                        style={{ flex: 1, padding: '8px', fontSize: '10px' }}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartSolo}
                className="btn-arcade"
                style={{ width: '100%', padding: '16px', fontSize: '14px', marginTop: '20px' }}
              >
                🏁 START SOLO RACE
              </button>
            </div>
          </div>
        ) : (
          /* Multiplayer Card */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            {/* Create Room */}
            <div className="arcade-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '14px', color: 'var(--accent)', marginBottom: '12px' }}>
                  HOST A NEW ROOM
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#AAA', lineHeight: '1.6', marginBottom: '24px' }}>
                  Create an instant game room with a 6-character room code. Share the code with up to 7 friends to race in real-time.
                </p>
                <div style={{
                  padding: '16px',
                  background: 'rgba(0, 229, 255, 0.05)',
                  border: '1px dashed var(--accent)',
                  borderRadius: '4px',
                  marginBottom: '24px',
                  fontFamily: 'var(--font-pixel)',
                  fontSize: '10px',
                  color: '#FFF',
                }}>
                  ✓ 30 Hz SNAPSHOT NETCODE<br />
                  ✓ CLIENT-SIDE PREDICTION<br />
                  ✓ SUPPORTS UP TO 8 PLAYERS
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                className="btn-arcade"
                style={{ width: '100%', padding: '16px', fontSize: '13px' }}
              >
                CREATE ROOM CODE
              </button>
            </div>

            {/* Join Room */}
            <div className="arcade-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '14px', color: 'var(--accent-2)', marginBottom: '12px' }}>
                  JOIN WITH ROOM CODE
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#AAA', lineHeight: '1.6', marginBottom: '24px' }}>
                  Enter the 6-character room code provided by your friend to jump directly into their lobby.
                </p>

                <form onSubmit={handleJoinRoom}>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="ENTER CODE (e.g. K7X9Q2)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    style={{
                      width: '100%',
                      background: 'var(--bg-1)',
                      border: '2px solid var(--accent-2)',
                      padding: '14px',
                      color: '#FFF',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '16px',
                      textAlign: 'center',
                      letterSpacing: '4px',
                      marginBottom: '20px',
                      textTransform: 'uppercase',
                    }}
                  />
                  <button
                    type="submit"
                    className="btn-arcade btn-arcade-secondary"
                    style={{ width: '100%', padding: '16px', fontSize: '13px' }}
                  >
                    JOIN LOBBY
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
