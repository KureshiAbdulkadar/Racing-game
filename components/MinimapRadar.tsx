'use client';

import React, { useRef, useEffect } from 'react';
import { TrackData } from '@/game/tracks/track-data';
import { CarState } from '@/game/physics/car-physics';

interface MinimapProps {
  track: TrackData;
  cars: CarState[];
  playerCarId: string;
  width?: number;
  height?: number;
}

export default function MinimapRadar({
  track,
  cars,
  playerCarId,
  width = 170,
  height = 130,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Track dimensions in pixels
    const trackWidth = track.cols * track.tileSize;
    const trackHeight = track.rows * track.tileSize;

    const scaleX = (width - 24) / trackWidth;
    const scaleY = (height - 24) / trackHeight;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (width - trackWidth * scale) / 2;
    const offsetY = (height - trackHeight * scale) / 2;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Draw Track Path from Waypoints
    if (track.waypoints && track.waypoints.length > 2) {
      ctx.beginPath();
      const first = track.waypoints[0];
      ctx.moveTo(offsetX + first.x * scale, offsetY + first.y * scale);
      for (let i = 1; i < track.waypoints.length; i++) {
        const wp = track.waypoints[i];
        ctx.lineTo(offsetX + wp.x * scale, offsetY + wp.y * scale);
      }
      ctx.closePath();

      // Outer track glow
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)';
      ctx.lineWidth = 14 * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Main track road
      ctx.strokeStyle = '#2B303C';
      ctx.lineWidth = 9 * scale;
      ctx.stroke();

      // Track centerline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw 3D Nitro Pickups on Radar
    if (track.nitroPickups) {
      track.nitroPickups.forEach((pickup) => {
        if (pickup.active) {
          const px = offsetX + pickup.x * scale;
          const py = offsetY + pickup.y * scale;
          ctx.fillStyle = '#00E5FF';
          ctx.shadowColor = '#00E5FF';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    }

    // Draw Finish Gate icon on Radar
    if (track.finishGate) {
      const fx = offsetX + track.finishGate.x * scale;
      const fy = offsetY + track.finishGate.y * scale;
      ctx.fillStyle = '#00FF66';
      ctx.shadowColor = '#00FF66';
      ctx.shadowBlur = 6;
      ctx.fillRect(fx - 4, fy - 2, 8, 4);
      ctx.shadowBlur = 0;
    }

    // Draw AI Opponent Cars
    const opponentColors = ['#00FF66', '#FF1744', '#FFD600', '#FFFFFF'];
    let opIndex = 0;

    cars.forEach((car) => {
      if (car.id === playerCarId) return;

      const cx = offsetX + car.x * scale;
      const cy = offsetY + car.y * scale;
      const color = opponentColors[opIndex % opponentColors.length];
      opIndex++;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Player Car Arrow
    const playerCar = cars.find((c) => c.id === playerCarId);
    if (playerCar) {
      const px = offsetX + playerCar.x * scale;
      const py = offsetY + playerCar.y * scale;

      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(playerCar.angle);

      // Player directional arrow
      ctx.fillStyle = '#FF3D00';
      ctx.shadowColor = '#FF3D00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();

      // Outer glow pulse
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.restore();
    }
  }, [track, cars, playerCarId, width, height]);

  return (
    <div style={{
      position: 'relative',
      width: `${width}px`,
      height: `${height}px`,
      background: 'rgba(10, 12, 18, 0.85)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
      overflow: 'hidden',
      userSelect: 'none',
      pointerEvents: 'none',
    }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {/* Radar Tag */}
      <div style={{
        position: 'absolute',
        top: '4px',
        left: '8px',
        fontSize: '8px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        color: 'rgba(255, 255, 255, 0.5)',
        fontFamily: 'monospace',
      }}>
        RADAR
      </div>
    </div>
  );
}
