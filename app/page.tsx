'use client';

import React, { useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { getSoundEngine } from '@/game/engine/audio';
import { getPlayerCarCustomization } from '@/db/storage';
import { applyTheme } from '@/design-tokens/theme';

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    applyTheme('neon-night');
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const custom = getPlayerCarCustomization();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Draw glowing turntable platform
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.beginPath();
      ctx.ellipse(0, 30, 80, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Rotating car
      angle += 0.02;
      ctx.rotate(angle);

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.beginPath();
      ctx.ellipse(3, 4, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wheels
      ctx.fillStyle = '#111';
      ctx.fillRect(-18, -16, 12, 6);
      ctx.fillRect(10, -16, 12, 6);
      ctx.fillRect(-18, 10, 12, 6);
      ctx.fillRect(10, 10, 12, 6);

      // Body
      ctx.fillStyle = custom.primaryColor || '#00E5FF';
      ctx.fillRect(-20, -12, 40, 24);

      // Roof / Cabin
      ctx.fillStyle = custom.secondaryColor || '#FF00A8';
      ctx.fillRect(-8, -8, 20, 16);

      // Windshield
      ctx.fillStyle = '#00EAFF';
      ctx.fillRect(5, -6, 6, 12);
      ctx.fillRect(-6, -6, 4, 12);

      // Headlights & Taillights
      ctx.fillStyle = '#FFF';
      ctx.fillRect(20, -8, 4, 4);
      ctx.fillRect(20, 4, 4, 4);

      ctx.fillStyle = '#FF0044';
      ctx.fillRect(-22, -9, 3, 4);
      ctx.fillRect(-22, 5, 3, 4);

      ctx.restore();
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleStartAudio = () => {
    const sound = getSoundEngine();
    sound.unlock();
    sound.playBoost();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Feature Badges */}
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '28px',
        }}>
          <span style={{
            padding: '6px 12px',
            background: 'rgba(0, 229, 255, 0.1)',
            border: '1px solid var(--accent)',
            borderRadius: '2px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '9px',
            color: 'var(--accent)',
          }}>
            ⚡ LOCKED 90+ FPS
          </span>
          <span style={{
            padding: '6px 12px',
            background: 'rgba(255, 0, 168, 0.1)',
            border: '1px solid var(--accent-2)',
            borderRadius: '2px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '9px',
            color: 'var(--accent-2)',
          }}>
            🎮 SUB-50MS LATENCY
          </span>
          <span style={{
            padding: '6px 12px',
            background: 'rgba(255, 234, 0, 0.1)',
            border: '1px solid #FFEA00',
            borderRadius: '2px',
            fontFamily: 'var(--font-pixel)',
            fontSize: '9px',
            color: '#FFEA00',
          }}>
            🏁 6-CHAR ROOM CODES
          </span>
        </div>

        {/* Hero Title */}
        <h1 className="pixel-title glow-pulse" style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          marginBottom: '16px',
          color: '#FFFFFF',
        }}>
          PIXEL RACER
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.8rem',
          color: '#A0A0B0',
          maxWidth: '650px',
          marginBottom: '32px',
          letterSpacing: '1px',
        }}>
          ARCADE DRIFTING • MULTIPLAYER LOBBIES • HIGH REFRESH SIMULATION
        </p>

        {/* Interactive Car Turntable */}
        <div style={{
          position: 'relative',
          marginBottom: '36px',
          cursor: 'pointer',
        }} onClick={handleStartAudio} title="Click to test engine sound!">
          <canvas
            ref={canvasRef}
            width={240}
            height={160}
            style={{ imageRendering: 'pixelated' }}
          />
          <div style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: '8px',
            color: '#777',
            marginTop: '4px',
          }}>
            [ CLICK TO REV ENGINE ]
          </div>
        </div>

        {/* Action Menu */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          width: '100%',
          maxWidth: '340px',
        }}>
          <a
            href="/play"
            className="btn-arcade"
            onClick={handleStartAudio}
            style={{ padding: '16px 28px', fontSize: '14px' }}
          >
            ▶ PLAY NOW
          </a>

          <a
            href="/customize"
            className="btn-arcade btn-arcade-secondary"
            style={{ padding: '14px 24px', fontSize: '12px' }}
          >
            ⚙ CUSTOMIZE CAR
          </a>

          <div style={{ display: 'flex', gap: '12px' }}>
            <a
              href="/profile"
              className="btn-arcade btn-arcade-ghost"
              style={{ flex: 1, padding: '12px', fontSize: '10px' }}
            >
              DRIVER CARD
            </a>
            <a
              href="/settings"
              className="btn-arcade btn-arcade-ghost"
              style={{ flex: 1, padding: '12px', fontSize: '10px' }}
            >
              SETTINGS
            </a>
          </div>
        </div>

        {/* Controls Quick Reference */}
        <div style={{
          marginTop: '48px',
          padding: '16px 24px',
          background: 'rgba(20, 20, 40, 0.5)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          display: 'flex',
          gap: '24px',
          fontFamily: 'var(--font-pixel)',
          fontSize: '9px',
          color: '#888',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <span>WASD / ARROWS : STEER & GAS</span>
          <span>SPACE : DRIFT</span>
          <span>SHIFT : BOOST</span>
          <span>H : HORN</span>
        </div>
      </main>
    </div>
  );
}
