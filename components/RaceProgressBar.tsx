'use client';

import React from 'react';
import { CarState } from '@/game/physics/car-physics';

interface RaceProgressProps {
  cars: CarState[];
  playerCarId: string;
  distanceRemainingMeters?: number;
  currentLap?: number;
  totalLaps?: number;
}

export default function RaceProgressBar({
  cars,
  playerCarId,
  distanceRemainingMeters,
  currentLap = 1,
  totalLaps = 2,
}: RaceProgressProps) {
  const playerCar = cars.find((c) => c.id === playerCarId);
  const playerProgress = playerCar ? Math.min(100, Math.max(0, playerCar.raceProgress || 0)) : 0;

  const opponentColors = ['#00FF66', '#FF1744', '#FFD600', '#FFFFFF', '#00E5FF'];
  let opIdx = 0;

  const isFinalSprint = distanceRemainingMeters !== undefined && distanceRemainingMeters <= 120 && distanceRemainingMeters > 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      userSelect: 'none',
    }}>
      {/* Top Distance to Finish & Sprint Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: isFinalSprint ? 'rgba(255, 61, 0, 0.9)' : 'rgba(10, 14, 24, 0.85)',
        backdropFilter: 'blur(8px)',
        border: isFinalSprint ? '1px solid #FF3D00' : '1px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '16px',
        padding: '4px 14px',
        boxShadow: isFinalSprint ? '0 0 20px #FF3D00' : '0 4px 16px rgba(0,0,0,0.5)',
        transition: 'all 0.3s ease',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: '900',
          letterSpacing: '1.5px',
          color: isFinalSprint ? '#FFF' : '#00FF66',
          textShadow: '0 0 8px currentColor',
        }}>
          {isFinalSprint ? '🔥 FINAL SPRINT TO FINISH!' : '🏁 DESTINATION'}
        </span>

        {distanceRemainingMeters !== undefined && (
          <span style={{
            fontSize: '13px',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 'bold',
            color: '#FFFFFF',
            letterSpacing: '1px',
          }}>
            {distanceRemainingMeters}m TO GO
          </span>
        )}

        <span style={{
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'var(--font-mono, monospace)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.2)',
          paddingLeft: '8px',
        }}>
          LAP {currentLap}/{totalLaps} ({Math.round(playerProgress)}%)
        </span>
      </div>

      {/* Main Track Progress Bar */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        height: '32px',
        background: 'rgba(10, 12, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '20px',
        padding: '4px 16px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
      }}>
        {/* Start Label */}
        <span style={{
          fontSize: '9px',
          fontWeight: 'bold',
          color: 'rgba(255, 255, 255, 0.5)',
          letterSpacing: '1px',
          marginRight: '10px',
          fontFamily: 'monospace',
        }}>
          START
        </span>

        {/* Track Progress Bar Line */}
        <div style={{
          position: 'relative',
          flex: 1,
          height: '6px',
          background: 'rgba(255, 255, 255, 0.12)',
          borderRadius: '3px',
          overflow: 'visible',
        }}>
          {/* Filled Progress Gradient for Player */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${playerProgress}%`,
            background: 'linear-gradient(90deg, #FF9100 0%, #FF3D00 100%)',
            borderRadius: '3px',
            boxShadow: '0 0 8px #FF3D00',
            transition: 'width 0.15s ease-out',
          }} />

          {/* AI Opponent Dots */}
          {cars.map((car) => {
            if (car.id === playerCarId) return null;
            const progress = Math.min(100, Math.max(0, car.raceProgress || 0));
            const color = opponentColors[opIdx++ % opponentColors.length];

            return (
              <div
                key={car.id}
                style={{
                  position: 'absolute',
                  left: `${progress}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: color,
                  border: '1px solid #111',
                  boxShadow: `0 0 6px ${color}`,
                  transition: 'left 0.2s linear',
                  zIndex: 2,
                }}
              />
            );
          })}

          {/* Player Car Marker */}
          <div style={{
            position: 'absolute',
            left: `${playerProgress}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#FF3D00',
            border: '2px solid #FFFFFF',
            boxShadow: '0 0 12px #FF3D00',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            fontWeight: '900',
            color: '#FFF',
            transition: 'left 0.15s ease-out',
            zIndex: 5,
          }}>
            ▲
          </div>
        </div>

        {/* Finish Flag Label */}
        <span style={{
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#00FF66',
          letterSpacing: '1px',
          marginLeft: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontFamily: 'monospace',
          textShadow: '0 0 8px rgba(0,255,102,0.6)',
        }}>
          🏁 FINISH
        </span>
      </div>
    </div>
  );
}
