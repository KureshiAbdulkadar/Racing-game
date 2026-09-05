'use client';

import React, { useEffect, useState, use } from 'react';
import Navbar from '@/components/Navbar';
import { RoomClient } from '@/game/netcode/room-client';
import { RoomStateData, PlayerRoomInfo } from '@/game/netcode/protocol';
import { getPlayerCarCustomization, getUserProfile } from '@/db/storage';
import { ALL_TRACKS } from '@/game/tracks/track-data';
import { getSoundEngine } from '@/game/engine/audio';

export default function RoomLobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const roomCode = resolvedParams.code.toUpperCase();

  const [client, setClient] = useState<RoomClient | null>(null);
  const [roomState, setRoomState] = useState<RoomStateData | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const profile = getUserProfile();
    const custom = getPlayerCarCustomization();
    const sound = getSoundEngine();

    const playerInfo: PlayerRoomInfo = {
      id: profile.id,
      slot: 0,
      isHost: false,
      isReady: false,
      customization: { ...custom, displayName: profile.displayName },
    };

    const roomClient = new RoomClient(roomCode, playerInfo);

    roomClient.onRoomState = (state) => {
      setRoomState(state);
      const me = state.players.find((p) => p.id === profile.id);
      if (me) setIsReady(me.isReady);
    };

    roomClient.onCountdown = (count) => {
      setCountdown(count);
      sound.unlock();
      sound.playCountdownBeep(count === 0);
    };

    roomClient.onRaceStart = (matchId) => {
      window.location.href = `/race/${matchId}?track=${roomState?.trackId || 'neon-circuit'}&mode=multi`;
    };

    roomClient.connect();
    setClient(roomClient);

    return () => {
      roomClient.disconnect();
    };
  }, [roomCode]);

  const toggleReady = () => {
    if (!client) return;
    const nextReady = !isReady;
    setIsReady(nextReady);
    client.setReady(nextReady);
    const sound = getSoundEngine();
    sound.unlock();
    sound.playBoost();
  };

  const handleStartRace = () => {
    if (!client) return;
    client.startRace();
  };

  const handleTrackChange = (trackId: string) => {
    if (!client) return;
    client.selectTrack(trackId);
  };

  const copyInvite = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const profile = typeof window !== 'undefined' ? getUserProfile() : null;
  const isHost = roomState ? roomState.hostId === profile?.id : false;
  const selectedTrack = ALL_TRACKS[roomState?.trackId || 'neon-circuit'] || ALL_TRACKS['neon-circuit'];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        padding: '32px 20px',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        position: 'relative',
      }}>
        {/* Countdown Overlay */}
        {countdown !== null && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div className="pixel-title" style={{
              fontSize: '5rem',
              color: countdown === 0 ? '#00FF44' : '#FFEA00',
              animation: 'pulseGlow 0.8s infinite',
            }}>
              {countdown === 0 ? 'GO!' : countdown}
            </div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '14px', color: '#FFF', marginTop: '20px' }}>
              PREPARE FOR RACE...
            </div>
          </div>
        )}

        {/* Room Header & Code Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
          background: 'rgba(20, 20, 40, 0.8)',
          border: '2px solid var(--accent)',
          padding: '20px 24px',
          borderRadius: '4px',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#AAA', marginBottom: '4px' }}>
              MULTIPLAYER LOBBY (UP TO 8 RACERS)
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span className="pixel-title" style={{ fontSize: '28px', color: 'var(--accent)', letterSpacing: '4px' }}>
                {roomCode}
              </span>
              <button
                onClick={copyInvite}
                className="btn-arcade"
                style={{ padding: '8px 16px', fontSize: '10px' }}
              >
                {copied ? '✓ COPIED!' : '📋 COPY INVITE LINK'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={toggleReady}
              className={`btn-arcade ${isReady ? 'btn-arcade-secondary' : 'btn-arcade-ghost'}`}
              style={{ padding: '12px 24px' }}
            >
              {isReady ? '✓ READY!' : 'READY UP'}
            </button>

            {isHost && (
              <button
                onClick={handleStartRace}
                className="btn-arcade"
                style={{ padding: '12px 24px', background: 'var(--accent)', color: '#000' }}
              >
                🏁 START RACE
              </button>
            )}
          </div>
        </div>

        {/* Grid Layout: Players & Track Setup */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Player Grid (8 Slots) */}
          <div className="arcade-card">
            <div style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: '12px',
              color: 'var(--accent)',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>PLAYERS IN LOBBY</span>
              <span>{(roomState?.players.length || 1)} / 8</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.from({ length: 8 }).map((_, slotIdx) => {
                const player = roomState?.players[slotIdx];
                if (player) {
                  return (
                    <div
                      key={'player-' + player.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        background: 'var(--bg-1)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Car Color Dot */}
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '2px',
                          backgroundColor: player.customization.primaryColor,
                          border: '2px solid ' + player.customization.secondaryColor,
                        }} />
                        <div>
                          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '11px', color: '#FFF' }}>
                            {player.customization.displayName} {player.isHost && '👑'}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#888' }}>
                            {player.customization.bodyId.toUpperCase()} #{player.customization.raceNumber}
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontFamily: 'var(--font-pixel)',
                        fontSize: '9px',
                        padding: '4px 8px',
                        background: player.isReady ? 'rgba(0, 255, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        border: player.isReady ? '1px solid #00FF44' : '1px solid #555',
                        color: player.isReady ? '#00FF44' : '#888',
                      }}>
                        {player.isReady ? 'READY' : 'WAITING'}
                      </span>
                    </div>
                  );
                }

                // Empty Slot
                return (
                  <div
                    key={'empty-slot-' + slotIdx}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '9px',
                      color: '#444',
                    }}
                  >
                    SLOT {slotIdx + 1} : WAITING FOR RACER...
                  </div>
                );
              })}
            </div>
          </div>

          {/* Track Selection & Rules */}
          <div className="arcade-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '12px',
                color: 'var(--accent-2)',
                marginBottom: '16px',
              }}>
                TRACK CONFIGURATION
              </div>

              {/* Host track picker */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                  CIRCUIT {isHost ? '(HOST CAN CHANGE)' : ''}
                </label>
                {isHost ? (
                  <select
                    value={roomState?.trackId || 'neon-circuit'}
                    onChange={(e) => handleTrackChange(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-1)',
                      border: '1px solid var(--accent)',
                      color: '#FFF',
                      padding: '12px',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '11px',
                    }}
                  >
                    {Object.values(ALL_TRACKS).map((trk) => (
                      <option key={trk.id} value={trk.id}>
                        {trk.name} ({trk.lapLengthMeters}m)
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: '12px',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '11px',
                    color: '#FFF',
                  }}>
                    {selectedTrack.name}
                  </div>
                )}
              </div>

              {/* Track Details */}
              <div style={{
                padding: '16px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                marginBottom: '20px',
              }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '11px', color: '#FFF', marginBottom: '8px' }}>
                  {selectedTrack.name.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#AAA', lineHeight: '1.6' }}>
                  • Distance: {selectedTrack.lapLengthMeters} meters per lap<br />
                  • Standard: {selectedTrack.lapsDefault} Laps<br />
                  • Hazards: Oil slicks, boost strips, tight corners<br />
                  • Surface: Asphalt & Off-road grass
                </div>
              </div>
            </div>

            <div style={{
              padding: '12px',
              background: 'rgba(0, 229, 255, 0.05)',
              border: '1px solid var(--accent)',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: '#FFF',
              textAlign: 'center',
            }}>
              💡 You can also test multiplayer by opening this URL in a second browser tab!
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
