'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { getUserProfile, UserProfile, getPlayerCarCustomization } from '@/db/storage';
import { CAR_BODIES } from '@/game/physics/car-physics';
import { ALL_TRACKS } from '@/game/tracks/track-data';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(getUserProfile());
  const [car, setCar] = useState(getPlayerCarCustomization());

  useEffect(() => {
    setProfile(getUserProfile());
    setCar(getPlayerCarCustomization());
  }, []);

  const totalPodiums = profile.stats.firstPlaces + profile.stats.secondPlaces + profile.stats.thirdPlaces;
  const winRate = profile.stats.racesCompleted > 0
    ? Math.round((profile.stats.firstPlaces / profile.stats.racesCompleted) * 100)
    : 0;

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
        <h1 className="pixel-title" style={{ fontSize: '24px', color: '#FFF', marginBottom: '8px' }}>
          DRIVER PROFILE & CAREER
        </h1>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#A0A0B0', marginBottom: '28px' }}>
          STATS • TRACK RECORDS • UNLOCKABLE VEHICLE CLASSES
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Driver License Card */}
          <div className="arcade-card arcade-card-glow" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '2px solid var(--accent)',
              paddingBottom: '12px',
              marginBottom: '20px',
            }}>
              <span className="pixel-title" style={{ fontSize: '12px', color: 'var(--accent)' }}>
                ARCADE RACING LICENSE
              </span>
              <span style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '9px',
                padding: '3px 8px',
                background: 'rgba(0, 229, 255, 0.2)',
                border: '1px solid var(--accent)',
                color: '#FFF',
              }}>
                {profile.isGuest ? 'GUEST PASS' : 'PRO DRIVER'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
              {/* Avatar Box */}
              <div style={{
                width: '80px',
                height: '80px',
                background: 'var(--bg-1)',
                border: '2px solid var(--accent-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '2.5rem',
                color: '#FFF',
              }}>
                🏁
              </div>

              <div>
                <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: '18px', color: '#FFF', marginBottom: '6px' }}>
                  {profile.displayName}
                </h2>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#AAA' }}>
                  ID: {profile.id.substring(0, 12)}
                </div>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '10px', color: 'var(--accent)', marginTop: '6px' }}>
                  ACTIVE RIDE: {car.bodyId.toUpperCase()} #{car.raceNumber}
                </div>
              </div>
            </div>

            {/* Level Progress */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '10px', marginBottom: '6px' }}>
                <span>CLASS TIER {profile.level}</span>
                <span style={{ color: 'var(--accent-2)' }}>{profile.xp} XP TOTAL</span>
              </div>
              <div style={{ height: '12px', background: '#222', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, ((profile.xp % 300) / 300) * 100)}%`,
                  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#777', marginTop: '6px', textAlign: 'right' }}>
                {300 - (profile.xp % 300)} XP to Next Tier
              </div>
            </div>
          </div>

          {/* Career Stats Grid */}
          <div className="arcade-card">
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: 'var(--accent)', marginBottom: '16px' }}>
              CAREER STATS
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--bg-1)', padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '4px' }}>
                  RACES FINISHED
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: '#FFF', fontWeight: 'bold' }}>
                  {profile.stats.racesCompleted}
                </div>
              </div>

              <div style={{ background: 'var(--bg-1)', padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '4px' }}>
                  1ST PLACE WINS
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: '#FFEA00', fontWeight: 'bold' }}>
                  {profile.stats.firstPlaces}
                </div>
              </div>

              <div style={{ background: 'var(--bg-1)', padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '4px' }}>
                  TOTAL PODIUMS
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: 'var(--accent)', fontWeight: 'bold' }}>
                  {totalPodiums}
                </div>
              </div>

              <div style={{ background: 'var(--bg-1)', padding: '14px', border: '1px solid var(--border)' }}>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: '#888', marginBottom: '4px' }}>
                  WIN RATE
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: '#00FF44', fontWeight: 'bold' }}>
                  {winRate}%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Track Records Section */}
        <div className="arcade-card" style={{ marginTop: '24px' }}>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: 'var(--accent-2)', marginBottom: '16px' }}>
            PERSONAL BEST CIRCUIT RECORDS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {Object.values(ALL_TRACKS).map((trk) => {
              const bestMs = profile.stats.bestLaps[trk.id];
              const bestFormatted = bestMs ? `${(bestMs / 1000).toFixed(2)}s` : '--:--';

              return (
                <div key={trk.id} style={{
                  padding: '16px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                }}>
                  <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '11px', color: '#FFF', marginBottom: '4px' }}>
                    {trk.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                    Difficulty: {'★'.repeat(trk.difficulty)}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: '9px', color: 'var(--accent)' }}>BEST LAP:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 'bold', color: '#FFF' }}>
                      {bestFormatted}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
