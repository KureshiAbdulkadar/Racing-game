'use client';

import React from 'react';

interface SpeedometerProps {
  speedKmh: number;
  maxSpeedKmh?: number;
  boostActive?: boolean;
}

export default function SpeedometerGauge({
  speedKmh,
  maxSpeedKmh = 320,
  boostActive = false,
}: SpeedometerProps) {
  const clampedSpeed = Math.max(0, Math.min(maxSpeedKmh, speedKmh));
  // Needle angle from -135 deg to +135 deg (270 deg sweep)
  const sweepAngle = (clampedSpeed / maxSpeedKmh) * 270 - 135;

  return (
    <div style={{
      position: 'relative',
      width: '150px',
      height: '150px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(20, 20, 30, 0.85) 0%, rgba(10, 10, 16, 0.95) 75%)',
      border: '3px solid rgba(255, 255, 255, 0.25)',
      boxShadow: boostActive
        ? '0 0 25px rgba(0, 229, 255, 0.7), inset 0 0 15px rgba(0, 229, 255, 0.3)'
        : '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 12px rgba(255, 255, 255, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      overflow: 'hidden',
    }}>
      {/* Dial Tick Marks SVG */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 150 150">
        {Array.from({ length: 25 }).map((_, i) => {
          const angleDeg = -135 + (i / 24) * 270;
          const angleRad = (angleDeg * Math.PI) / 180;
          const rInner = i % 4 === 0 ? 56 : 62;
          const rOuter = 68;
          const x1 = 75 + Math.cos(angleRad) * rInner;
          const y1 = 75 + Math.sin(angleRad) * rInner;
          const x2 = 75 + Math.cos(angleRad) * rOuter;
          const y2 = 75 + Math.sin(angleRad) * rOuter;
          const isRedline = i >= 20;

          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={isRedline ? '#FF1744' : i % 4 === 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'}
              strokeWidth={i % 4 === 0 ? 2.5 : 1.2}
            />
          );
        })}

        {/* Needle */}
        <g transform={`rotate(${sweepAngle} 75 75)`}>
          <line
            x1="75"
            y1="75"
            x2="75"
            y2="18"
            stroke={boostActive ? '#00E5FF' : '#FF3D00'}
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="drop-shadow(0 0 4px #FF3D00)"
          />
          <circle cx="75" cy="75" r="7" fill="#EEEEEE" />
          <circle cx="75" cy="75" r="3" fill="#111111" />
        </g>
      </svg>

      {/* Digital Speed Display */}
      <div style={{
        marginTop: '32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 2,
      }}>
        <div style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: '32px',
          fontWeight: 'bold',
          color: boostActive ? '#00E5FF' : '#FFFFFF',
          lineHeight: '1',
          textShadow: boostActive ? '0 0 10px #00E5FF' : '0 0 8px rgba(255,255,255,0.4)',
        }}>
          {Math.round(clampedSpeed)}
        </div>
        <div style={{
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '7px',
          color: 'rgba(255, 255, 255, 0.6)',
          marginTop: '4px',
          letterSpacing: '1px',
        }}>
          KM/H
        </div>
      </div>
    </div>
  );
}
