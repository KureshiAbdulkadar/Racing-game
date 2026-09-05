'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import { getTrack, TrackData } from '@/game/tracks/track-data';
import {
  CarState,
  createCarState,
  updateCarPhysics,
} from '@/game/physics/car-physics';
import { AICarController, generateAIOpponents } from '@/game/ai/bot';
import { GameLoop, TelemetryStats } from '@/game/engine/loop';
import { InputManager } from '@/game/engine/input';
import { ThreeRenderer } from '@/game/engine/three-renderer';
import { getSoundEngine } from '@/game/engine/audio';
import { getPlayerCarCustomization, recordRaceFinish } from '@/db/storage';
import { THEMES } from '@/design-tokens/theme';
import SpeedometerGauge from '@/components/SpeedometerGauge';
import MinimapRadar from '@/components/MinimapRadar';
import RaceProgressBar from '@/components/RaceProgressBar';
import NitroBar from '@/components/NitroBar';

export default function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ track?: string; bots?: string; diff?: string; laps?: string }>;
}) {
  const resolvedParams = use(params);
  const resolvedSearch = use(searchParams);
  const matchId = resolvedParams.matchId;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    fps: 60,
    frameTimeP50: 16.6,
    frameTimeP95: 18.0,
    droppedFrames: 0,
  });
  const [isPaused, setIsPaused] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Live HUD States
  const [speedKmh, setSpeedKmh] = useState(0);
  const [boostMeter, setBoostMeter] = useState(60);
  const [isBoost, setIsBoost] = useState(false);
  const [isOffRoad, setIsOffRoad] = useState(false);
  const [countdownText, setCountdownText] = useState<string | null>('3');
  const [currentPosition, setCurrentPosition] = useState<number>(5);
  const [currentLap, setCurrentLap] = useState<number>(1);
  const [maxLaps, setMaxLaps] = useState<number>(2);
  const [lapTimeStr, setLapTimeStr] = useState<string>('00:00.00');
  const [distanceRemaining, setDistanceRemaining] = useState<number>(1500);
  const [camModeLabel, setCamModeLabel] = useState<string>('CHASE');
  const [nitroAlert, setNitroAlert] = useState<boolean>(false);
  const [raceFinishedData, setRaceFinishedData] = useState<{ pos: number; time: string; best: string } | null>(null);

  // Track & Cars for HUD Mini-Map
  const [hudTrack, setHudTrack] = useState<TrackData | null>(null);
  const [hudCars, setHudCars] = useState<CarState[]>([]);

  const inputManagerRef = useRef<InputManager | null>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const rendererRef = useRef<ThreeRenderer | null>(null);

  useEffect(() => {
    // Detect mobile
    if (typeof window !== 'undefined') {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const trackId = resolvedSearch.track || 'neon-circuit';
    const track = getTrack(trackId);
    const botCount = Math.min(7, Math.max(1, parseInt(resolvedSearch.bots || '4', 10)));
    const botTier = (resolvedSearch.diff || 'pro') as 'rookie' | 'pro' | 'legend';
    const totalLaps = parseInt(resolvedSearch.laps || '2', 10);
    track.lapsDefault = totalLaps;
    setMaxLaps(totalLaps);
    setHudTrack(track);

    const sound = getSoundEngine();
    sound.unlock();
    sound.startEngine();
    sound.startRetroMusic('race');

    // 1. Initialize Player & AI Racers
    const playerCustom = getPlayerCarCustomization();
    const playerCar = createCarState('player-1', track.spawnSlots[0], playerCustom, false);

    const botProfiles = generateAIOpponents(botCount, botTier);
    const botCars: CarState[] = botProfiles.map((prof, i) => {
      const spawnSlot = track.spawnSlots[(i + 1) % track.spawnSlots.length];
      return createCarState(`bot-${i + 1}`, spawnSlot, prof, true, prof.decal === 'stripe' ? 'pro' : 'legend');
    });
    const botControllers = botCars.map((bot) => new AICarController(bot.id, bot.aiTier));

    const allCars: CarState[] = [playerCar, ...botCars];
    setHudCars([...allCars]);

    // 2. Initialize 3D ThreeRenderer
    const renderer = new ThreeRenderer(canvas);
    renderer.resize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    const inputMgr = new InputManager(
      () => setIsPaused((prev) => !prev),
      () => sound.playHorn(playerCustom.hornId),
      () => {
        const nextMode = renderer.cycleCameraMode();
        setCamModeLabel(nextMode.toUpperCase());
      }
    );
    inputManagerRef.current = inputMgr;

    // 3. Race State
    let raceStatus: 'countdown' | 'racing' | 'finished' = 'countdown';
    let countdownVal = 3;
    let countdownTimer = 1.0;
    sound.playCountdownBeep(false);

    let finishRank = 1;
    let finishTriggered = false;
    let hudUpdateCounter = 0;

    // Fixed timestep physics update (60 Hz)
    const updatePhysics = (dt: number) => {
      if (isPaused) return;

      // Handle Countdown
      if (raceStatus === 'countdown') {
        countdownTimer -= dt;
        if (countdownTimer <= 0) {
          countdownVal--;
          if (countdownVal > 0) {
            sound.playCountdownBeep(false);
            setCountdownText(String(countdownVal));
            countdownTimer = 1.0;
          } else if (countdownVal === 0) {
            sound.playCountdownBeep(true);
            setCountdownText('GO!');
            countdownTimer = 0.8;
          } else {
            raceStatus = 'racing';
            setCountdownText(null);
          }
        }
      }

      // Update Player Car
      const playerInput = raceStatus === 'racing' ? inputMgr.getInput() : {
        throttle: 0,
        brake: 0,
        steer: 0,
        drift: false,
        boost: false,
        horn: false,
      };

      const prevVel = playerCar.velocity;

      updateCarPhysics(
        playerCar,
        playerInput,
        track,
        dt,
        (car, lap, lapTime) => {
          sound.playLapComplete();
        },
        (car, pickupId) => {
          // Triggered when Nitro Gas bottle is collected!
          sound.playNitroPickup();
          setNitroAlert(true);
          setTimeout(() => setNitroAlert(false), 1400);
        }
      );

      // Sound & Particle Feedback
      const speedRatio = Math.abs(playerCar.velocity) / (playerCar.stats.topSpeed || 280);
      sound.updateEnginePitch(speedRatio, playerCar.isDrifting, playerCar.boostActive);

      if (playerCar.isDrifting) {
        sound.playTireSqueal(true);
        renderer.emitDriftParticles(playerCar.x, playerCar.y, playerCar.angle);
        renderer.addSkid(playerCar.prevX, playerCar.prevY, playerCar.x, playerCar.y);
      } else {
        sound.playTireSqueal(false);
      }

      if (playerCar.boostActive) {
        renderer.emitBoostParticles(playerCar.x, playerCar.y, playerCar.angle, playerCar.customization.primaryColor);
      }

      // Wall collision crash sound
      if (prevVel > 80 && playerCar.velocity < 0) {
        sound.playImpact(prevVel / 150);
        renderer.emitSparks(playerCar.x, playerCar.y);
      }

      // Update AI Opponents
      botCars.forEach((bot, index) => {
        const botCtrl = botControllers[index];
        const botInput = raceStatus === 'racing' ? botCtrl.update(bot, track, dt) : {
          throttle: 0,
          brake: 0,
          steer: 0,
          drift: false,
          boost: false,
          horn: false,
        };
        updateCarPhysics(bot, botInput, track, dt);
      });

      // Update Live HUD data
      hudUpdateCounter++;
      if (hudUpdateCounter % 3 === 0) {
        // Speed in KM/H (approx 1 physics pixel/sec = ~0.95 km/h, up to 450 km/h with 2x Nitro!)
        const kmh = Math.round(Math.abs(playerCar.velocity) * 0.95);
        setSpeedKmh(kmh);
        setBoostMeter(Math.round(playerCar.boostMeter));
        setIsBoost(playerCar.boostActive);
        setIsOffRoad(playerCar.isOffRoad);
        setCurrentLap(Math.min(playerCar.currentLap, track.lapsDefault));

        // Format lap time
        const m = Math.floor(playerCar.currentLapTime / 60);
        const s = Math.floor(playerCar.currentLapTime % 60);
        const ms = Math.floor((playerCar.currentLapTime % 1) * 100);
        setLapTimeStr(`${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}.${ms < 10 ? '0' : ''}${ms}`);

        // Calculate live distance remaining to finish in meters
        const totalMeters = (track.lapLengthMeters || 750) * track.lapsDefault;
        const progressPct = Math.min(100, Math.max(0, playerCar.raceProgress || 0));
        const remMeters = Math.max(0, Math.round((1 - progressPct / 100) * totalMeters));
        setDistanceRemaining(remMeters);

        // Rank by lap progress and checkpoint index
        const sorted = [...allCars].sort((a, b) => {
          if (a.raceProgress !== b.raceProgress) return (b.raceProgress || 0) - (a.raceProgress || 0);
          if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap;
          return b.checkpointIndex - a.checkpointIndex;
        });
        const rank = sorted.findIndex((c) => c.id === playerCar.id) + 1;
        setCurrentPosition(rank > 0 ? rank : 1);

        // Update cars state for Radar and Progress Bar
        setHudCars([...allCars]);
      }

      allCars.forEach((c) => {
        if (c.isFinished && c.finishPosition === null) {
          c.finishPosition = finishRank++;
        }
      });

      if (playerCar.isFinished && !finishTriggered) {
        finishTriggered = true;
        raceStatus = 'finished';

        // Emit victory celebration 3D confetti cannon burst!
        renderer.emitConfettiBurst(playerCar.x, playerCar.y);

        const finalPos = playerCar.finishPosition || finishRank;
        const totalTimeStr = playerCar.totalTime.toFixed(2);
        const bestLapStr = playerCar.bestLapTime?.toFixed(2) || '0.00';

        setRaceFinishedData({
          pos: finalPos,
          time: totalTimeStr,
          best: bestLapStr,
        });

        recordRaceFinish(track.id, finalPos, playerCar.totalTime, playerCar.bestLapTime);

        // Auto-redirect to results after celebration
        setTimeout(() => {
          window.location.href = `/results/${matchId}?track=${track.id}&pos=${finalPos}&time=${totalTimeStr}&best=${bestLapStr}`;
        }, 4500);
      }
    };

    // Decoupled interpolation render loop (60-90+ FPS)
    const renderScene = (alpha: number) => {
      const themeColors = THEMES['neon-night'].colors;
      renderer.render(
        track,
        allCars,
        playerCar.id,
        alpha,
        themeColors,
        raceStatus === 'countdown' ? countdownVal : null,
        raceStatus
      );
    };

    const loop = new GameLoop(updatePhysics, renderScene, (stats) => {
      setTelemetry(stats);
    });
    loop.start();
    gameLoopRef.current = loop;

    return () => {
      loop.stop();
      sound.stopEngine();
      sound.playTireSqueal(false);
      sound.stopMusic();
      inputMgr.destroy();
      window.removeEventListener('resize', handleResize);
    };
  }, [matchId, resolvedSearch]);

  const handleResume = () => setIsPaused(false);
  const handleExit = () => {
    window.location.href = '/play';
  };

  const cycleCam = () => {
    if (rendererRef.current) {
      const next = rendererRef.current.cycleCameraMode();
      setCamModeLabel(next.toUpperCase());
    }
  };

  // Touch handlers for mobile
  const handleTouchSteer = (dir: number) => {
    inputManagerRef.current?.setTouchInput({ steer: dir });
  };
  const handleTouchGas = (active: boolean) => {
    inputManagerRef.current?.setTouchInput({ throttle: active ? 1 : 0 });
  };
  const handleTouchBrake = (active: boolean) => {
    inputManagerRef.current?.setTouchInput({ brake: active ? 1 : 0 });
  };
  const handleTouchDrift = (active: boolean) => {
    inputManagerRef.current?.setTouchInput({ drift: active });
  };
  const handleTouchBoost = () => {
    inputManagerRef.current?.setTouchInput({ boost: true });
    setTimeout(() => inputManagerRef.current?.setTouchInput({ boost: false }), 450);
  };

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />

      {/* Screen-Space 2X Nitro Speed Warp Overlay (Asphalt Style) */}
      {isBoost && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 8,
          boxShadow: 'inset 0 0 100px rgba(0, 229, 255, 0.4), inset 0 0 40px rgba(255, 61, 0, 0.3)',
          background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0, 229, 255, 0.15) 100%)',
        }} />
      )}

      {/* Top Center: 0-100% Race Progress Bar with Live Distance to Finish */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '90%',
        maxWidth: '480px',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <RaceProgressBar
          cars={hudCars}
          playerCarId="player-1"
          distanceRemainingMeters={distanceRemaining}
          currentLap={currentLap}
          totalLaps={maxLaps}
        />
      </div>

      {/* Top Left: Race Progress & Position HUD */}
      <div style={{
        position: 'absolute',
        top: '16px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        {/* Placement */}
        <div style={{
          background: 'rgba(12, 14, 22, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderLeft: '4px solid #FF3D00',
          padding: '8px 18px',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <span style={{ fontSize: '11px', color: '#AAA', letterSpacing: '1px', fontWeight: 'bold' }}>POS</span>
          <span style={{
            fontSize: '32px',
            fontWeight: '900',
            fontStyle: 'italic',
            color: currentPosition === 1 ? '#00FF66' : currentPosition <= 3 ? '#FFD600' : '#FFFFFF',
            lineHeight: 1,
            textShadow: '0 0 12px rgba(255,61,0,0.5)',
          }}>
            {getOrdinal(currentPosition)}
          </span>
          <span style={{ fontSize: '14px', color: '#888' }}>/ {hudCars.length || 5}</span>
        </div>

        {/* Lap and Time */}
        <div style={{
          background: 'rgba(12, 14, 22, 0.85)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          padding: '8px 16px',
          borderRadius: '6px',
          display: 'flex',
          gap: '16px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '12px',
          color: '#EEE',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div>
            <span style={{ color: '#888', marginRight: '6px' }}>LAP</span>
            <span style={{ fontWeight: 'bold', color: '#00E5FF' }}>{currentLap}/{maxLaps}</span>
          </div>
          <div>
            <span style={{ color: '#888', marginRight: '6px' }}>TIME</span>
            <span style={{ fontWeight: 'bold' }}>{lapTimeStr}</span>
          </div>
        </div>

        {/* Off-Road Warning Badge */}
        {isOffRoad && (
          <div style={{
            background: 'rgba(255, 23, 68, 0.85)',
            color: '#FFF',
            fontWeight: 'bold',
            fontSize: '10px',
            letterSpacing: '1px',
            padding: '4px 8px',
            borderRadius: '4px',
            textAlign: 'center',
            boxShadow: '0 0 10px #FF1744',
            animation: 'pulse 0.6s infinite',
          }}>
            ⚠️ OFF-ROAD (REDUCED SPEED)
          </div>
        )}
      </div>

      {/* Top Right: Camera Switcher & Telemetry */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '20px',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        zIndex: 10,
      }}>
        <button
          onClick={cycleCam}
          className="btn-arcade"
          style={{ padding: '8px 14px', fontSize: '11px', letterSpacing: '1px' }}
          title="Toggle Camera (Hotkey: C)"
        >
          📷 {camModeLabel} [C]
        </button>

        <button
          onClick={() => setIsPaused(true)}
          className="btn-arcade btn-arcade-ghost"
          style={{ padding: '8px 14px', fontSize: '11px' }}
          title="Pause Game (Hotkey: ESC)"
        >
          ⏸ PAUSE
        </button>

        <div style={{
          background: 'rgba(10, 10, 20, 0.8)',
          border: '1px solid rgba(255,255,255,0.15)',
          padding: '8px 12px',
          borderRadius: '4px',
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px',
          color: telemetry.fps >= 55 ? '#00FF44' : '#FFEA00',
          display: 'flex',
          gap: '10px',
        }}>
          <span>{telemetry.fps} FPS</span>
        </div>
      </div>

      {/* Center Screen: Nitro Pickup Banner Alert */}
      {nitroAlert && (
        <div style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 30,
          animation: 'pulse 0.4s ease-in-out',
        }}>
          <div style={{
            background: 'linear-gradient(90deg, rgba(0,229,255,0.9), rgba(255,61,0,0.9))',
            color: '#FFFFFF',
            padding: '8px 24px',
            borderRadius: '20px',
            fontSize: '18px',
            fontWeight: '900',
            fontStyle: 'italic',
            letterSpacing: '2px',
            textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            boxShadow: '0 0 25px #00E5FF',
          }}>
            ⚡ +2X SUPER NITRO COLLECTED!
          </div>
        </div>
      )}

      {/* Center Screen: Countdown (3.. 2.. 1.. GO!) */}
      {countdownText && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 20,
        }}>
          <div style={{
            fontSize: countdownText === 'GO!' ? '110px' : '140px',
            fontWeight: '900',
            fontStyle: 'italic',
            fontFamily: '"Arial Black", Impact, sans-serif',
            color: countdownText === 'GO!' ? '#00FF66' : '#FF3D00',
            textShadow: countdownText === 'GO!'
              ? '0 0 35px #00FF66, 0 8px 16px rgba(0,0,0,0.8)'
              : '0 0 35px #FF3D00, 0 8px 16px rgba(0,0,0,0.8)',
            transform: 'scale(1.1)',
            letterSpacing: '2px',
            animation: 'pulse 0.8s ease-in-out infinite',
          }}>
            {countdownText}
          </div>
        </div>
      )}

      {/* Bottom Left: Live Minimap Radar & Controls Hint */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10,
      }}>
        {hudTrack && (
          <MinimapRadar
            track={hudTrack}
            cars={hudCars}
            playerCarId="player-1"
            width={170}
            height={130}
          />
        )}

        <div style={{
          background: 'rgba(10, 10, 16, 0.75)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.1)',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: '10px',
          color: '#BBB',
          display: isMobile ? 'none' : 'flex',
          gap: '10px',
        }}>
          <span><b style={{ color: '#FFF' }}>↑/W</b> Drive</span>
          <span><b style={{ color: '#FFF' }}>←/→</b> Steer</span>
          <span><b style={{ color: '#00E5FF' }}>SPACE</b> Drift</span>
          <span><b style={{ color: '#FF3D00' }}>SHIFT</b> 2x Nitro</span>
        </div>
      </div>

      {/* Bottom Center: Segmented Nitro Boost Meter */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 15,
      }}>
        <NitroBar boostMeter={boostMeter} boostActive={isBoost} />
      </div>

      {/* Bottom Right: Circular Speedometer Gauge */}
      <div style={{
        position: 'absolute',
        bottom: '24px',
        right: '24px',
        zIndex: 15,
        pointerEvents: 'none',
      }}>
        <SpeedometerGauge
          speedKmh={speedKmh}
          maxSpeedKmh={420}
          boostActive={isBoost}
        />
      </div>

      {/* Mobile Virtual Controls */}
      {isMobile && (
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '24px',
          alignItems: 'flex-end',
        }}>
          {/* Left steering pad */}
          <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
            <button
              onTouchStart={() => handleTouchSteer(-1)}
              onTouchEnd={() => handleTouchSteer(0)}
              className="btn-arcade"
              style={{ width: '64px', height: '64px', fontSize: '20px', padding: 0 }}
            >
              ◀
            </button>
            <button
              onTouchStart={() => handleTouchSteer(1)}
              onTouchEnd={() => handleTouchSteer(0)}
              className="btn-arcade"
              style={{ width: '64px', height: '64px', fontSize: '20px', padding: 0 }}
            >
              ▶
            </button>
          </div>

          {/* Right action controls */}
          <div style={{ display: 'flex', gap: '12px', pointerEvents: 'auto' }}>
            <button
              onTouchStart={() => handleTouchDrift(true)}
              onTouchEnd={() => handleTouchDrift(false)}
              className="btn-arcade btn-arcade-ghost"
              style={{ width: '56px', height: '56px', fontSize: '10px', padding: 0 }}
            >
              DRIFT
            </button>
            <button
              onTouchStart={handleTouchBoost}
              className="btn-arcade btn-arcade-secondary"
              style={{ width: '56px', height: '56px', fontSize: '10px', padding: 0 }}
            >
              NITRO
            </button>
            <button
              onTouchStart={() => handleTouchBrake(true)}
              onTouchEnd={() => handleTouchBrake(false)}
              className="btn-arcade"
              style={{ width: '60px', height: '60px', fontSize: '10px', padding: 0, borderColor: '#FF3860', color: '#FF3860' }}
            >
              BRAKE
            </button>
            <button
              onTouchStart={() => handleTouchGas(true)}
              onTouchEnd={() => handleTouchGas(false)}
              className="btn-arcade"
              style={{ width: '64px', height: '64px', fontSize: '12px', padding: 0 }}
            >
              GAS
            </button>
          </div>
        </div>
      )}

      {/* Race Finished Victory Celebration Overlay */}
      {raceFinishedData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 7, 12, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        }}>
          <div className="arcade-card" style={{ width: '380px', textAlign: 'center', padding: '32px 24px' }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '8px',
            }}>
              {raceFinishedData.pos === 1 ? '🏆' : raceFinishedData.pos <= 3 ? '🥈' : '🏁'}
            </div>

            <h2 className="pixel-title" style={{
              fontSize: '28px',
              color: raceFinishedData.pos === 1 ? '#00FF66' : '#FFD600',
              marginBottom: '8px',
              textShadow: '0 0 15px currentColor',
            }}>
              {raceFinishedData.pos === 1 ? 'VICTORY!' : 'RACE FINISHED!'}
            </h2>

            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#FFF', marginBottom: '16px' }}>
              FINISHED {getOrdinal(raceFinishedData.pos)} PLACE
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '14px',
              marginBottom: '20px',
              fontFamily: 'var(--font-mono, monospace)',
              display: 'flex',
              justifyContent: 'space-around',
            }}>
              <div>
                <div style={{ fontSize: '10px', color: '#888' }}>TOTAL TIME</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#00E5FF' }}>{raceFinishedData.time}s</div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#888' }}>BEST LAP</div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFD600' }}>{raceFinishedData.best}s</div>
              </div>
            </div>

            <button
              onClick={() => {
                window.location.href = `/results/${matchId}?track=${hudTrack?.id || 'neon-circuit'}&pos=${raceFinishedData.pos}&time=${raceFinishedData.time}&best=${raceFinishedData.best}`;
              }}
              className="btn-arcade"
              style={{ width: '100%', padding: '14px' }}
            >
              VIEW RESULTS & REWARDS →
            </button>
          </div>
        </div>
      )}

      {/* Pause Menu Modal */}
      {isPaused && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(10, 10, 20, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="arcade-card" style={{ width: '320px', textAlign: 'center' }}>
            <h2 className="pixel-title" style={{ fontSize: '22px', color: 'var(--accent)', marginBottom: '24px' }}>
              PAUSED
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <button onClick={handleResume} className="btn-arcade" style={{ padding: '14px' }}>
                RESUME RACE
              </button>
              <button onClick={cycleCam} className="btn-arcade btn-arcade-ghost" style={{ padding: '14px' }}>
                CHANGE CAMERA ({camModeLabel})
              </button>
              <button onClick={handleExit} className="btn-arcade btn-arcade-secondary" style={{ padding: '14px' }}>
                EXIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
