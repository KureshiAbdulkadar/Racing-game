'use client';

import React from 'react';

interface NitroBarProps {
  boostMeter: number;  // 0 to 100
  boostActive: boolean;
}

export default function NitroBar({
  boostMeter,
  boostActive,
}: NitroBarProps) {
  const clamped = Math.max(0, Math.min(100, boostMeter));
  const segments = 4;
  const segmentWidth = 100 / segments;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: '4px',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      {/* Title & Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '0 2px',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '900',
          fontStyle: 'italic',
          color: boostActive ? '#00E5FF' : '#FFD600',
          letterSpacing: '1.5px',
          textShadow: boostActive ? '0 0 10px #00E5FF' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          ⚡ {boostActive ? '2X SUPER NITRO ACTIVE' : 'NITRO BOOST'}
        </span>
        <span style={{
          fontSize: '9px',
          fontFamily: 'monospace',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          [SHIFT / PICKUP]
        </span>
      </div>

      {/* Segmented Nitro Bar Container */}
      <div style={{
        position: 'relative',
        width: '220px',
        height: '14px',
        background: 'rgba(10, 12, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        border: boostActive ? '1.5px solid #00E5FF' : '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '4px',
        padding: '2px',
        boxShadow: boostActive ? '0 0 16px rgba(0, 229, 255, 0.6)' : '0 4px 12px rgba(0,0,0,0.5)',
        display: 'flex',
        gap: '2px',
        overflow: 'hidden',
      }}>
        {/* Fill Layer */}
        <div style={{
          position: 'absolute',
          left: '2px',
          top: '2px',
          bottom: '2px',
          width: `calc(${clamped}% - 4px)`,
          background: boostActive
            ? 'linear-gradient(90deg, #00B0FF 0%, #00E5FF 50%, #76FF03 100%)'
            : 'linear-gradient(90deg, #FF6D00 0%, #FFD600 100%)',
          borderRadius: '2px',
          boxShadow: boostActive ? '0 0 10px #00E5FF' : '0 0 6px #FFD600',
          transition: 'width 0.1s linear',
        }} />

        {/* Dividers */}
        {Array.from({ length: segments - 1 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(i + 1) * segmentWidth}%`,
              top: 0,
              bottom: 0,
              width: '1.5px',
              background: 'rgba(0, 0, 0, 0.6)',
              zIndex: 3,
            }}
          />
        ))}
      </div>
    </div>
  );
}
