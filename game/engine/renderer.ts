import { CarState } from '../physics/car-physics';
import { TrackData, SURFACE_TYPES } from '../tracks/track-data';
import { ThemeColors } from '../../design-tokens/theme';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

interface SpeedLine {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
}

export type CameraMode = 'gaze' | 'chase-stable' | 'top-down';

export class PixelRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private skidMarks: SkidMark[] = [];
  private speedLines: SpeedLine[] = [];
  private maxSkids = 250;

  // Camera Settings
  public cameraMode: CameraMode = 'gaze'; // Gaze tracking: Rock-solid map, no shaking, forward lookahead!
  public cameraX = 0;
  public cameraY = 0;
  public zoom = 1.6;
  private camAngle = 0;
  private camToastText = '';
  private camToastTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;

    // Speed lines for boost effect
    for (let i = 0; i < 35; i++) {
      this.speedLines.push({
        x: Math.random() * 800,
        y: Math.random() * 600,
        length: 20 + Math.random() * 40,
        speed: 12 + Math.random() * 20,
        alpha: 0.2 + Math.random() * 0.5,
      });
    }
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = false;
  }

  public cycleCameraMode(): CameraMode {
    if (this.cameraMode === 'gaze') {
      this.cameraMode = 'top-down';
      this.showToast('CAM: CLASSIC TOP-DOWN');
    } else if (this.cameraMode === 'top-down') {
      this.cameraMode = 'chase-stable';
      this.showToast('CAM: STABILIZED CHASE');
    } else {
      this.cameraMode = 'gaze';
      this.showToast('CAM: GAZE TRACKING (STABLE MAP)');
    }
    return this.cameraMode;
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    this.showToast(`CAM: ${mode.toUpperCase()}`);
  }

  public addTrauma(val: number) {
    // Isolated impact feedback without shaking the entire world map
  }

  private showToast(msg: string) {
    this.camToastText = msg;
    this.camToastTimer = 1.8;
  }

  public render(
    track: TrackData,
    cars: CarState[],
    playerCarId: string,
    alpha: number,
    theme: ThemeColors,
    countdown: number | null,
    raceStatus: 'countdown' | 'racing' | 'finished'
  ) {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Find player car
    const playerCar = cars.find((c) => c.id === playerCarId) || cars[0];

    let interpX = 0;
    let interpY = 0;
    let interpAngle = 0;

    if (playerCar) {
      interpX = playerCar.prevX + (playerCar.x - playerCar.prevX) * alpha;
      interpY = playerCar.prevY + (playerCar.y - playerCar.prevY) * alpha;

      let dAngle = playerCar.angle - playerCar.prevAngle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      interpAngle = playerCar.prevAngle + dAngle * alpha;
    }

    // Clear background
    ctx.save();
    ctx.fillStyle = theme.bg0;
    ctx.fillRect(0, 0, width, height);

    // =========================================================================
    // CAMERA POSITIONING (GAZE TRACKING vs STABILIZED CHASE vs TOP-DOWN)
    // =========================================================================
    const speed = playerCar ? Math.abs(playerCar.velocity) : 0;
    const speedRatio = playerCar ? Math.min(1.4, speed / playerCar.stats.topSpeed) : 0;

    if (this.cameraMode === 'gaze') {
      // 1. GAZE TRACKING: Rock-solid map. NO ROTATION. NO SHAKING.
      // The camera's focal point leads ahead in the direction the car is heading,
      // placing the car behind the camera gaze so you see far ahead into the road.
      const lookaheadDist = 140 + speedRatio * 180;
      const gazeTargetX = interpX + Math.cos(interpAngle) * lookaheadDist;
      const gazeTargetY = interpY + Math.sin(interpAngle) * lookaheadDist;

      const targetCamX = gazeTargetX - width / (2 * this.zoom);
      const targetCamY = gazeTargetY - height / (2 * this.zoom);

      // Smooth damped follow (no map shaking or abrupt jerking on left/right steering!)
      this.cameraX += (targetCamX - this.cameraX) * 0.08;
      this.cameraY += (targetCamY - this.cameraY) * 0.08;

      // Speed-adaptive zoom
      const targetZoom = playerCar?.boostActive ? 1.4 : (1.65 - speedRatio * 0.2);
      this.zoom += (targetZoom - this.zoom) * 0.06;

      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-Math.floor(this.cameraX), -Math.floor(this.cameraY));
    } else if (this.cameraMode === 'chase-stable') {
      // 2. STABILIZED CHASE: Smooth rotational follow with deadzone so steering left/right
      // does NOT shake the walls.
      let diff = interpAngle - this.camAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      // Deadzone: small left/right adjustments do NOT rotate the map
      if (Math.abs(diff) > 0.2) {
        this.camAngle += (diff - Math.sign(diff) * 0.2) * 0.05;
      }

      const screenCarX = width / 2;
      const screenCarY = height * 0.70;

      const targetZoom = playerCar?.boostActive ? 1.4 : (1.6 - speedRatio * 0.18);
      this.zoom += (targetZoom - this.zoom) * 0.06;

      ctx.translate(screenCarX, screenCarY);
      ctx.scale(this.zoom, this.zoom);
      ctx.rotate(-(this.camAngle + Math.PI / 2));
      ctx.translate(-interpX, -interpY);
    } else {
      // 3. TOP-DOWN: Centered classic overhead
      const targetCamX = interpX - width / (2 * this.zoom);
      const targetCamY = interpY - height / (2 * this.zoom);
      this.cameraX += (targetCamX - this.cameraX) * 0.12;
      this.cameraY += (targetCamY - this.cameraY) * 0.12;

      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-Math.floor(this.cameraX), -Math.floor(this.cameraY));
    }

    // 1. Draw Track Surface Tiles (Stable, clean tiles)
    const focalX = interpX;
    const focalY = interpY;
    this.drawTrack(track, theme, focalX, focalY);

    // 2. Draw Skid Marks
    this.drawSkidMarks();

    // 3. Update & Draw Particles (smoke, sparks, boost exhaust)
    this.updateAndDrawParticles();

    // 4. Sort cars by Y for pseudo-depth
    const sortedCars = [...cars].sort((a, b) => a.y - b.y);

    // 5. Draw Car Shadows & Sprites
    sortedCars.forEach((car) => {
      this.drawCar(car, alpha, car.id === playerCarId);
    });

    ctx.restore();

    // =========================================================================
    // SCREEN-SPACE FX (SPEED LINES & HUD)
    // =========================================================================
    if (playerCar) {
      if (speedRatio > 0.7 || playerCar.boostActive) {
        this.drawSpeedLines(width, height, speedRatio, playerCar.boostActive);
      }

      this.drawHUD(playerCar, cars, track, countdown, raceStatus, theme);
    }

    // Camera Mode Switch Toast
    if (this.camToastTimer > 0) {
      this.camToastTimer -= 1 / 60;
      this.drawCameraToast(width, height, theme);
    }
  }

  private drawTrack(track: TrackData, theme: ThemeColors, centerX: number, centerY: number) {
    const ctx = this.ctx;
    const tileSize = track.tileSize;

    // Calculate bounding box that covers the visible screen
    const maxScreenDist = Math.sqrt(this.canvas.width * this.canvas.width + this.canvas.height * this.canvas.height) / this.zoom;
    const tileRadius = Math.ceil(maxScreenDist / tileSize) + 2;

    const centerCol = Math.floor(centerX / tileSize);
    const centerRow = Math.floor(centerY / tileSize);

    const startCol = Math.max(0, centerCol - tileRadius);
    const endCol = Math.min(track.cols - 1, centerCol + tileRadius);
    const startRow = Math.max(0, centerRow - tileRadius);
    const endRow = Math.min(track.rows - 1, centerRow + tileRadius);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const x = c * tileSize;
        const y = r * tileSize;
        const type = track.tiles[r][c];

        switch (type) {
          case SURFACE_TYPES.GRASS:
            ctx.fillStyle = theme.grass;
            ctx.fillRect(x, y, tileSize, tileSize);
            if ((r + c) % 3 === 0) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
              ctx.fillRect(x + 8, y + 8, 4, 4);
              ctx.fillRect(x + 20, y + 22, 4, 4);
            }
            break;

          case SURFACE_TYPES.TRACK:
            ctx.fillStyle = theme.track;
            ctx.fillRect(x, y, tileSize, tileSize);
            if ((r * 7 + c * 13) % 5 === 0) {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
              ctx.fillRect(x + 12, y + 14, 3, 3);
            }
            break;

          case SURFACE_TYPES.OIL:
            ctx.fillStyle = theme.track;
            ctx.fillRect(x, y, tileSize, tileSize);
            ctx.fillStyle = 'rgba(15, 15, 25, 0.85)';
            ctx.beginPath();
            ctx.ellipse(x + 16, y + 16, 14, 11, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
            break;

          case SURFACE_TYPES.BOOST:
            ctx.fillStyle = theme.track;
            ctx.fillRect(x, y, tileSize, tileSize);
            ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
            ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);
            ctx.fillStyle = '#00E5FF';
            ctx.beginPath();
            ctx.moveTo(x + 6, y + 24);
            ctx.lineTo(x + 16, y + 10);
            ctx.lineTo(x + 26, y + 24);
            ctx.lineTo(x + 16, y + 17);
            ctx.closePath();
            ctx.fill();
            break;

          case SURFACE_TYPES.WALL:
            ctx.fillStyle = '#101018';
            ctx.fillRect(x, y, tileSize, tileSize);
            ctx.fillStyle = theme.danger;
            ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(x + 2, y + 2);
            ctx.lineTo(x + 14, y + 2);
            ctx.lineTo(x + 2, y + 14);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x + 18, y + 2);
            ctx.lineTo(x + 30, y + 2);
            ctx.lineTo(x + 2, y + 30);
            ctx.lineTo(x + 2, y + 18);
            ctx.fill();
            break;

          case SURFACE_TYPES.FINISH:
            ctx.fillStyle = theme.track;
            ctx.fillRect(x, y, tileSize, tileSize);
            const checkSize = 8;
            for (let cy = 0; cy < tileSize; cy += checkSize) {
              for (let cx = 0; cx < tileSize; cx += checkSize) {
                const isWhite = ((cx / checkSize) + (cy / checkSize)) % 2 === 0;
                ctx.fillStyle = isWhite ? '#FFFFFF' : '#111111';
                ctx.fillRect(x + cx, y + cy, checkSize, checkSize);
              }
            }
            break;
        }
      }
    }
  }

  private drawSkidMarks() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(10, 10, 15, 0.55)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';

    for (const skid of this.skidMarks) {
      ctx.globalAlpha = skid.alpha;
      ctx.beginPath();
      ctx.moveTo(skid.x1, skid.y1);
      ctx.lineTo(skid.x2, skid.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }

  public addSkid(x1: number, y1: number, x2: number, y2: number) {
    this.skidMarks.push({ x1, y1, x2, y2, alpha: 0.65 });
    if (this.skidMarks.length > this.maxSkids) {
      this.skidMarks.shift();
    }
  }

  public emitDriftParticles(x: number, y: number, angle: number) {
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: -Math.cos(angle) * (25 + Math.random() * 35) + (Math.random() - 0.5) * 20,
        vy: -Math.sin(angle) * (25 + Math.random() * 35) + (Math.random() - 0.5) * 20,
        size: 3 + Math.random() * 4,
        color: '#E0E0E0',
        alpha: 0.75,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      });
    }
  }

  public emitBoostParticles(x: number, y: number, angle: number, color = '#00E5FF') {
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x - Math.cos(angle) * 12 + (Math.random() - 0.5) * 6,
        y: y - Math.sin(angle) * 12 + (Math.random() - 0.5) * 6,
        vx: -Math.cos(angle) * (70 + Math.random() * 50),
        vy: -Math.sin(angle) * (70 + Math.random() * 50),
        size: 3 + Math.random() * 3,
        color,
        alpha: 0.9,
        life: 0,
        maxLife: 0.25,
      });
    }
  }

  public emitSparks(x: number, y: number) {
    for (let i = 0; i < 8; i++) {
      const spAngle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 70;
      this.particles.push({
        x,
        y,
        vx: Math.cos(spAngle) * speed,
        vy: Math.sin(spAngle) * speed,
        size: 2.5,
        color: '#FFAA00',
        alpha: 1,
        life: 0,
        maxLife: 0.25,
      });
    }
  }

  private updateAndDrawParticles() {
    const ctx = this.ctx;
    const dt = 1 / 60;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const alphaProg = 1 - p.life / p.maxLife;

      ctx.save();
      ctx.globalAlpha = p.alpha * alphaProg;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), Math.ceil(p.size));
      ctx.restore();
    }
  }

  private drawCar(car: CarState, alpha: number, isPlayer: boolean) {
    const ctx = this.ctx;

    const renderX = Math.floor(car.prevX + (car.x - car.prevX) * alpha);
    const renderY = Math.floor(car.prevY + (car.y - car.prevY) * alpha);

    let dAngle = car.angle - car.prevAngle;
    while (dAngle > Math.PI) dAngle -= Math.PI * 2;
    while (dAngle < -Math.PI) dAngle += Math.PI * 2;
    const renderAngle = car.prevAngle + dAngle * alpha;

    ctx.save();
    ctx.translate(renderX, renderY);

    // 1. Underglow Neon (Player gets street racer underglow!)
    if (isPlayer) {
      ctx.save();
      ctx.rotate(renderAngle);
      ctx.fillStyle = car.customization.primaryColor;
      ctx.globalAlpha = car.boostActive ? 0.65 : 0.35;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Soft Ground Shadow
    ctx.save();
    ctx.translate(3, 4);
    ctx.rotate(renderAngle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Car Chassis Sprite
    ctx.rotate(renderAngle);

    // Wheels (4 black rubber pixel tires)
    ctx.fillStyle = '#111111';
    ctx.fillRect(-9, -8, 6, 3); // Rear left
    ctx.fillRect(5, -8, 6, 3);  // Front left
    ctx.fillRect(-9, 5, 6, 3);  // Rear right
    ctx.fillRect(5, 5, 6, 3);   // Front right

    // Main Body
    ctx.fillStyle = car.customization.primaryColor;
    ctx.fillRect(-10, -6, 20, 12);

    // Nose taper (Front is +X)
    ctx.beginPath();
    ctx.moveTo(10, -5);
    ctx.lineTo(13, -2);
    ctx.lineTo(13, 2);
    ctx.lineTo(10, 5);
    ctx.closePath();
    ctx.fill();

    // Roof & Cabin
    ctx.fillStyle = car.customization.secondaryColor;
    ctx.fillRect(-4, -4, 10, 8);

    // Windshield (Front glass)
    ctx.fillStyle = '#00EAFF';
    ctx.fillRect(2, -3, 3, 6);
    // Rear window
    ctx.fillRect(-3, -3, 2, 6);

    // Decals
    if (car.customization.decal === 'stripe') {
      ctx.fillStyle = car.customization.secondaryColor;
      ctx.fillRect(-10, -1, 22, 2);
    } else if (car.customization.decal === 'flame') {
      ctx.fillStyle = '#FF5500';
      ctx.fillRect(-5, -4, 4, 8);
      ctx.fillStyle = '#FFEA00';
      ctx.fillRect(-2, -2, 3, 4);
    } else if (car.customization.decal === 'star') {
      ctx.fillStyle = '#FFEA00';
      ctx.fillRect(-1, -1, 3, 3);
    }

    // Headlights (+X = front)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(12, -4, 2, 2);
    ctx.fillRect(12, 2, 2, 2);

    // LED Taillights (-X = rear)
    ctx.fillStyle = '#FF0044';
    ctx.fillRect(-10, -5, 2, 2);
    ctx.fillRect(-10, 3, 2, 2);

    // Red Taillight Glow
    ctx.fillStyle = 'rgba(255, 0, 68, 0.4)';
    ctx.fillRect(-13, -6, 3, 4);
    ctx.fillRect(-13, 2, 3, 4);

    // Nitro / Boost Flame Exhaust (Shoots backwards from -X rear)
    if (car.boostActive) {
      const flameLen = 8 + Math.random() * 6;
      ctx.fillStyle = '#00E5FF';
      ctx.fillRect(-10 - flameLen, -4, flameLen, 2);
      ctx.fillRect(-10 - flameLen, 2, flameLen, 2);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-10 - flameLen * 0.5, -3.5, flameLen * 0.5, 1);
      ctx.fillRect(-10 - flameLen * 0.5, 2.5, flameLen * 0.5, 1);
    }

    ctx.restore();

    // Driver name tag or player indicator
    if (isPlayer) {
      ctx.fillStyle = '#00E5FF';
      ctx.beginPath();
      ctx.moveTo(renderX, renderY - 18);
      ctx.lineTo(renderX - 4, renderY - 24);
      ctx.lineTo(renderX + 4, renderY - 24);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.fillText(car.customization.displayName, renderX, renderY - 14);
    }
  }

  private drawSpeedLines(width: number, height: number, speedRatio: number, isBoost: boolean) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = isBoost ? 'rgba(0, 229, 255, 0.35)' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1.5;

    const speedMult = isBoost ? 2.5 : speedRatio * 1.5;

    for (const line of this.speedLines) {
      line.y += line.speed * speedMult;
      if (line.y > height) {
        line.y = -line.length;
        line.x = Math.random() * width;
      }

      ctx.globalAlpha = line.alpha;
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x, line.y + line.length);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCameraToast(w: number, h: number, theme: ThemeColors) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 25, 0.9)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;

    const toastW = 320;
    const toastH = 40;
    const toastX = (w - toastW) / 2;
    const toastY = 120;

    ctx.fillRect(toastX, toastY, toastW, toastH);
    ctx.strokeRect(toastX, toastY, toastW, toastH);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.camToastText, w / 2, toastY + toastH / 2);
    ctx.restore();
  }

  private drawHUD(
    playerCar: CarState,
    allCars: CarState[],
    track: TrackData,
    countdown: number | null,
    raceStatus: 'countdown' | 'racing' | 'finished',
    theme: ThemeColors
  ) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Standings calculation
    const sorted = [...allCars].sort((a, b) => {
      if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap;
      if (a.checkpointIndex !== b.checkpointIndex) return b.checkpointIndex - a.checkpointIndex;
      return b.velocity - a.velocity;
    });
    const playerRank = sorted.findIndex((c) => c.id === playerCar.id) + 1;
    const rankSuffix = playerRank === 1 ? 'ST' : playerRank === 2 ? 'ND' : playerRank === 3 ? 'RD' : 'TH';

    // 1. Top HUD Bar (Lap, Position, Lap Time)
    ctx.save();
    ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
    ctx.fillRect(16, 16, 260, 80);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, 260, 80);

    ctx.font = '24px "VT323", monospace';
    ctx.fillStyle = theme.accent;
    ctx.fillText(`${playerRank}${rankSuffix}`, 28, 48);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#A0A0B0';
    ctx.fillText(`POS ${playerRank}/${allCars.length}`, 28, 74);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`LAP ${Math.min(playerCar.currentLap, track.lapsDefault)}/${track.lapsDefault}`, 120, 44);

    const curSec = (playerCar.currentLapTime % 60).toFixed(2).padStart(5, '0');
    const curMin = Math.floor(playerCar.currentLapTime / 60).toString().padStart(2, '0');
    ctx.fillStyle = theme.accent2;
    ctx.fillText(`${curMin}:${curSec}`, 120, 74);
    ctx.restore();

    // 2. Camera Mode Indicator Pill (Top Center)
    ctx.save();
    const camBadgeW = 240;
    const camBadgeH = 32;
    const camBadgeX = (w - camBadgeW) / 2;
    const camBadgeY = 16;

    ctx.fillStyle = 'rgba(10, 10, 25, 0.75)';
    ctx.fillRect(camBadgeX, camBadgeY, camBadgeW, camBadgeH);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camBadgeX, camBadgeY, camBadgeW, camBadgeH);

    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = theme.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const camLabel = this.cameraMode === 'gaze'
      ? 'GAZE TRACKING'
      : this.cameraMode === 'chase-stable'
      ? 'STABILIZED CHASE'
      : 'TOP-DOWN';
    ctx.fillText(`[C] CAM: ${camLabel}`, w / 2, camBadgeY + camBadgeH / 2);
    ctx.restore();

    // 3. Speedometer & Boost Gauge (Bottom Right)
    ctx.save();
    const speedBoxW = 200;
    const speedBoxH = 80;
    const speedBoxX = w - speedBoxW - 16;
    const speedBoxY = h - speedBoxH - 16;

    ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
    ctx.fillRect(speedBoxX, speedBoxY, speedBoxW, speedBoxH);
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 2;
    ctx.strokeRect(speedBoxX, speedBoxY, speedBoxW, speedBoxH);

    const speedKmh = Math.round(Math.abs(playerCar.velocity) * 0.85);
    ctx.font = '36px "VT323", monospace';
    ctx.fillStyle = playerCar.boostActive ? theme.accent2 : theme.accent;
    ctx.fillText(`${speedKmh}`, speedBoxX + 16, speedBoxY + 40);

    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillStyle = '#888899';
    ctx.fillText('KM/H', speedBoxX + 85, speedBoxY + 38);

    // Boost Gauge Bar
    const meterW = 168;
    const meterH = 10;
    const meterX = speedBoxX + 16;
    const meterY = speedBoxY + 54;

    ctx.fillStyle = '#222233';
    ctx.fillRect(meterX, meterY, meterW, meterH);

    const boostFill = (playerCar.boostMeter / 100) * meterW;
    ctx.fillStyle = playerCar.boostActive ? '#FF00A8' : '#00E5FF';
    ctx.fillRect(meterX, meterY, boostFill, meterH);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(playerCar.boostActive ? 'NITRO ENGAGED!' : 'BOOST [SHIFT]', meterX, meterY - 3);
    ctx.restore();

    // 4. Mini-map (Bottom Left)
    ctx.save();
    const mapSize = 140;
    const mapX = 16;
    const mapY = h - mapSize - 16;

    ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    const mapScaleX = (mapSize - 16) / (track.cols * track.tileSize);
    const mapScaleY = (mapSize - 16) / (track.rows * track.tileSize);

    // Track path on map
    if (track.waypoints.length > 0) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      track.waypoints.forEach((wp, i) => {
        const mx = mapX + 8 + wp.x * mapScaleX;
        const my = mapY + 8 + wp.y * mapScaleY;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.lineTo(mx, my);
      });
      ctx.closePath();
      ctx.stroke();
    }

    // Racer blips
    allCars.forEach((c) => {
      const bx = mapX + 8 + c.x * mapScaleX;
      const by = mapY + 8 + c.y * mapScaleY;

      if (c.id === playerCar.id) {
        ctx.fillStyle = '#00E5FF';
        ctx.beginPath();
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Direction arrow for player blip
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(c.angle) * 8, by + Math.sin(c.angle) * 8);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#FF0044';
        ctx.beginPath();
        ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();

    // 5. Countdown / Finished Overlays
    if (raceStatus === 'countdown' && countdown !== null) {
      ctx.save();
      ctx.font = '64px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (countdown > 0) {
        ctx.fillStyle = '#FFEA00';
        ctx.fillText(`${countdown}`, w / 2, h / 2);
      } else {
        ctx.fillStyle = '#00FF44';
        ctx.fillText('GO!', w / 2, h / 2);
      }
      ctx.restore();
    }

    if (playerCar.isFinished) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, h / 2 - 50, w, 100);

      ctx.font = '32px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFEA00';
      ctx.fillText('FINISHED!', w / 2, h / 2 - 5);

      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`POSITION: ${playerCar.finishPosition || playerRank}${rankSuffix}`, w / 2, h / 2 + 30);
      ctx.restore();
    }
  }
}
