'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import {
  CarCustomization,
  CarBodyType,
  CAR_BODIES,
  DEFAULT_CAR_CUSTOMIZATION,
} from '@/game/physics/car-physics';
import { PALETTE_32 } from '@/design-tokens/theme';
import {
  getPlayerCarCustomization,
  savePlayerCarCustomization,
  getUserProfile,
  saveUserProfile,
} from '@/db/storage';
import { getSoundEngine } from '@/game/engine/audio';

export default function CustomizePage() {
  const [custom, setCustom] = useState<CarCustomization>(DEFAULT_CAR_CUSTOMIZATION);
  const [savedAlert, setSavedAlert] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);

  useEffect(() => {
    const saved = getPlayerCarCustomization();
    const profile = getUserProfile();
    setCustom({ ...saved, displayName: profile.displayName });
  }, []);

  // Live turntable rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw pedestal
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.1)';
      ctx.beginPath();
      ctx.ellipse(0, 40, 110, 32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = custom.primaryColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      angleRef.current += 0.015;
      ctx.rotate(angleRef.current);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(4, 5, 36, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#111';
      ctx.fillRect(-24, -20, 14, 7);
      ctx.fillRect(12, -20, 14, 7);
      ctx.fillRect(-24, 13, 14, 7);
      ctx.fillRect(12, 13, 14, 7);

      // Car body
      ctx.fillStyle = custom.primaryColor;
      ctx.fillRect(-26, -15, 52, 30);

      // Nose taper
      ctx.beginPath();
      ctx.moveTo(26, -13);
      ctx.lineTo(34, -4);
      ctx.lineTo(34, 4);
      ctx.lineTo(26, 13);
      ctx.closePath();
      ctx.fill();

      // Roof / Cabin
      ctx.fillStyle = custom.secondaryColor;
      ctx.fillRect(-10, -10, 26, 20);

      // Glass
      ctx.fillStyle = '#00EAFF';
      ctx.fillRect(6, -8, 8, 16);
      ctx.fillRect(-8, -8, 6, 16);

      // Decal
      if (custom.decal === 'stripe') {
        ctx.fillStyle = custom.secondaryColor;
        ctx.fillRect(-26, -2, 60, 4);
      } else if (custom.decal === 'flame') {
        ctx.fillStyle = '#FF5500';
        ctx.fillRect(-15, -12, 8, 24);
        ctx.fillStyle = '#FFEA00';
        ctx.fillRect(-7, -8, 8, 16);
      } else if (custom.decal === 'star') {
        ctx.fillStyle = '#FFEA00';
        ctx.fillRect(-2, -2, 6, 6);
      }

      // Race number
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(custom.raceNumber.toString().padStart(2, '0'), 3, 4);

      // Headlights & Taillights
      ctx.fillStyle = '#FFF';
      ctx.fillRect(32, -10, 3, 5);
      ctx.fillRect(32, 5, 3, 5);
      ctx.fillStyle = '#FF0044';
      ctx.fillRect(-28, -12, 3, 6);
      ctx.fillRect(-28, 6, 3, 6);

      ctx.restore();
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [custom]);

  const handleSave = () => {
    savePlayerCarCustomization(custom);
    const profile = getUserProfile();
    profile.displayName = custom.displayName.trim() || 'Racer 1';
    saveUserProfile(profile);

    const sound = getSoundEngine();
    sound.unlock();
    sound.playBoost();

    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 2500);
  };

  const testHorn = (id: number) => {
    const sound = getSoundEngine();
    sound.unlock();
    sound.playHorn(id);
    setCustom((prev) => ({ ...prev, hornId: id }));
  };

  const currentStats = CAR_BODIES[custom.bodyId] || CAR_BODIES.sedan;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        padding: '32px 20px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 className="pixel-title" style={{ fontSize: '24px', color: '#FFF' }}>
              GARAGE & CUSTOMIZATION
            </h1>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#A0A0B0' }}>
              TUNE CHASSIS • SWAP PALETTE • PERSISTS ACROSS SESSIONS
            </p>
          </div>

          <button onClick={handleSave} className="btn-arcade" style={{ padding: '12px 24px' }}>
            💾 SAVE CAR
          </button>
        </div>

        {savedAlert && (
          <div style={{
            background: 'rgba(0, 229, 255, 0.2)',
            border: '1px solid var(--accent)',
            color: '#FFF',
            fontFamily: 'var(--font-pixel)',
            fontSize: '11px',
            padding: '12px',
            textAlign: 'center',
            marginBottom: '20px',
          }}>
            ✓ CAR & PROFILE SAVED SUCCESSFULLY!
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Left Column: 360 Turntable & Stats */}
          <div className="arcade-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <canvas
              ref={canvasRef}
              width={340}
              height={260}
              style={{ imageRendering: 'pixelated', width: '100%', maxWidth: '340px' }}
            />

            <div style={{ width: '100%', marginTop: '20px' }}>
              <div style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: '13px',
                color: 'var(--accent)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '8px',
              }}>
                CHASSIS TELEMETRY: {currentStats.name.toUpperCase()}
              </div>

              {/* Stats Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '9px', marginBottom: '4px' }}>
                    <span>TOP SPEED</span>
                    <span>{currentStats.topSpeed} KM/H</span>
                  </div>
                  <div style={{ height: '8px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(currentStats.topSpeed / 340) * 100}%`, background: 'var(--accent)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '9px', marginBottom: '4px' }}>
                    <span>ACCELERATION</span>
                    <span>{Math.round((currentStats.accel / 280) * 100)}%</span>
                  </div>
                  <div style={{ height: '8px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(currentStats.accel / 280) * 100}%`, background: 'var(--accent-2)' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '9px', marginBottom: '4px' }}>
                    <span>HANDLING & DRIFT</span>
                    <span>{Math.round((currentStats.handling / 4.5) * 100)}%</span>
                  </div>
                  <div style={{ height: '8px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(currentStats.handling / 4.5) * 100}%`, background: '#FFEA00' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '9px', marginBottom: '4px' }}>
                    <span>OFF-ROAD TRACTION</span>
                    <span>{Math.round(currentStats.offRoadGripMultiplier * 100)}%</span>
                  </div>
                  <div style={{ height: '8px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, currentStats.offRoadGripMultiplier * 70)}%`, background: '#00FF44' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Customization Controls */}
          <div className="arcade-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Display Name & Number */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                  DRIVER NAME
                </label>
                <input
                  type="text"
                  maxLength={16}
                  value={custom.displayName}
                  onChange={(e) => setCustom({ ...custom, displayName: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    padding: '10px 14px',
                    color: '#FFF',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '12px',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                  NUMBER (#)
                </label>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={custom.raceNumber}
                  onChange={(e) => setCustom({ ...custom, raceNumber: parseInt(e.target.value, 10) || 0 })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    padding: '10px 14px',
                    color: 'var(--accent)',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '12px',
                    textAlign: 'center',
                  }}
                />
              </div>
            </div>

            {/* Body Class Selection */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                VEHICLE CLASS
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {(['sedan', 'muscle', 'buggy', 'kart'] as CarBodyType[]).map((body) => (
                  <button
                    key={body}
                    onClick={() => setCustom({ ...custom, bodyId: body })}
                    className={`btn-arcade ${custom.bodyId === body ? '' : 'btn-arcade-ghost'}`}
                    style={{ padding: '10px', fontSize: '10px' }}
                  >
                    {CAR_BODIES[body].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Paint Palette */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                PRIMARY PAINT (32-COLOR PALETTE)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                {PALETTE_32.map((hex) => (
                  <div
                    key={'p-' + hex}
                    onClick={() => setCustom({ ...custom, primaryColor: hex })}
                    style={{
                      height: '24px',
                      backgroundColor: hex,
                      cursor: 'pointer',
                      border: custom.primaryColor === hex ? '2px solid #FFF' : '1px solid rgba(0,0,0,0.5)',
                      boxShadow: custom.primaryColor === hex ? '0 0 8px #FFF' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Secondary Paint Palette */}
            <div>
              <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                SECONDARY / ROOF ACCENT
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                {PALETTE_32.map((hex) => (
                  <div
                    key={'s-' + hex}
                    onClick={() => setCustom({ ...custom, secondaryColor: hex })}
                    style={{
                      height: '24px',
                      backgroundColor: hex,
                      cursor: 'pointer',
                      border: custom.secondaryColor === hex ? '2px solid #FFF' : '1px solid rgba(0,0,0,0.5)',
                      boxShadow: custom.secondaryColor === hex ? '0 0 8px #FFF' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Decals & Horns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                  LIVERY DECAL
                </label>
                <select
                  value={custom.decal}
                  onChange={(e) => setCustom({ ...custom, decal: e.target.value as any })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-1)',
                    border: '1px solid var(--border)',
                    color: '#FFF',
                    padding: '8px',
                    fontFamily: 'var(--font-pixel)',
                    fontSize: '10px',
                  }}
                >
                  <option value="none">NONE</option>
                  <option value="stripe">RACING STRIPE</option>
                  <option value="flame">FLAMES</option>
                  <option value="star">CHAMPION STAR</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-pixel)', fontSize: '10px', color: '#AAA', marginBottom: '8px' }}>
                  HORN TONE [CLICK TEST]
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5, 6].map((id) => (
                    <button
                      key={'horn-' + id}
                      onClick={() => testHorn(id)}
                      style={{
                        flex: 1,
                        background: custom.hornId === id ? 'var(--accent)' : 'var(--bg-1)',
                        color: custom.hornId === id ? '#000' : '#FFF',
                        border: '1px solid var(--border)',
                        fontFamily: 'var(--font-pixel)',
                        fontSize: '9px',
                        padding: '8px 2px',
                        cursor: 'pointer',
                      }}
                    >
                      #{id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
