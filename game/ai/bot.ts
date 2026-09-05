import { CarState, CarInputState, CarBodyType, CarCustomization } from '../physics/car-physics';
import { TrackData } from '../tracks/track-data';
import { PALETTE_32 } from '../../design-tokens/theme';

export interface AIOpponentProfile {
  name: string;
  bodyId: CarBodyType;
  primaryColor: string;
  secondaryColor: string;
  tier: 'rookie' | 'pro' | 'legend';
  number: number;
}

export const AI_NAMES_POOL: { name: string; bodyId: CarBodyType; tier: 'rookie' | 'pro' | 'legend' }[] = [
  { name: 'Vortex', bodyId: 'muscle', tier: 'legend' },
  { name: 'Shadow', bodyId: 'sedan', tier: 'pro' },
  { name: 'Blaze', bodyId: 'kart', tier: 'legend' },
  { name: 'DriftKing', bodyId: 'muscle', tier: 'pro' },
  { name: 'Nova', bodyId: 'sedan', tier: 'pro' },
  { name: 'Dusty', bodyId: 'buggy', tier: 'rookie' },
  { name: 'PixelAce', bodyId: 'kart', tier: 'pro' },
  { name: 'Racer-X', bodyId: 'muscle', tier: 'legend' },
  { name: 'Byte', bodyId: 'sedan', tier: 'rookie' },
  { name: 'Comet', bodyId: 'buggy', tier: 'pro' },
];

export function generateAIOpponents(count: number, preferredTier: 'rookie' | 'pro' | 'legend' = 'pro'): CarCustomization[] {
  const selected = AI_NAMES_POOL.slice(0, count);
  return selected.map((profile, i) => {
    const primaryColor = PALETTE_32[8 + (i * 3) % 20];
    const secondaryColor = PALETTE_32[15 + (i * 2) % 15];
    return {
      bodyId: profile.bodyId,
      primaryColor,
      secondaryColor,
      decal: (i % 2 === 0 ? 'stripe' : 'flame') as CarCustomization['decal'],
      raceNumber: (i + 1) * 11,
      hornId: (i % 6) + 1,
      trailId: (i % 4) + 1,
      displayName: profile.name,
    };
  });
}

export class AICarController {
  private currentWaypointIndex = 0;
  private steerSmoothing = 0;
  private boostCooldown = 0;

  constructor(private carId: string, private tier: 'rookie' | 'pro' | 'legend' = 'pro') {}

  public update(car: CarState, track: TrackData, dt: number): CarInputState {
    if (track.waypoints.length === 0 || car.isFinished) {
      return { throttle: 0, brake: 1, steer: 0, drift: false, boost: false, horn: false };
    }

    this.boostCooldown = Math.max(0, this.boostCooldown - dt);

    // 1. Waypoint Targeting
    const targetWp = track.waypoints[this.currentWaypointIndex];
    let targetX = targetWp.x;
    let targetY = targetWp.y;

    // Seek nearby active nitro pickups on straights
    if (track.nitroPickups) {
      for (const pickup of track.nitroPickups) {
        if (pickup.active) {
          const pDist = Math.hypot(pickup.x - car.x, pickup.y - car.y);
          if (pDist < 140) {
            // Blend target toward nitro pickup
            targetX = pickup.x;
            targetY = pickup.y;
            break;
          }
        }
      }
    }

    const dx = targetX - car.x;
    const dy = targetY - car.y;
    const distToWp = Math.sqrt(dx * dx + dy * dy);

    // Advance waypoint when close
    const waypointRadius = 85;
    if (distToWp < waypointRadius) {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % track.waypoints.length;
    }

    // Angle to target
    const targetAngle = Math.atan2(dy, dx);
    let angleDiff = targetAngle - car.angle;

    // Normalize angle to [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Steering sensitivity based on AI tier
    let steerGain = 1.7;
    let maxSteer = 1.0;
    let speedThreshold = 1.0;

    if (this.tier === 'rookie') {
      steerGain = 1.2;
      maxSteer = 0.85;
      speedThreshold = 0.85;
    } else if (this.tier === 'legend') {
      steerGain = 2.1;
      maxSteer = 1.0;
      speedThreshold = 1.0;
    }

    let desiredSteer = Math.max(-maxSteer, Math.min(maxSteer, angleDiff * steerGain));
    this.steerSmoothing += (desiredSteer - this.steerSmoothing) * Math.min(1, dt * 12);

    // 2. Throttle and Braking
    const sharpCorner = Math.abs(angleDiff) > 0.55;
    let throttle = 1.0;
    let brake = 0.0;
    let drift = false;
    let boost = false;

    // Check if on straightaway (start straight or high-speed straight)
    const isOnStraight = this.currentWaypointIndex <= 2 || this.currentWaypointIndex >= 12 || Math.abs(angleDiff) < 0.18;

    if (sharpCorner) {
      // Corner handling: drift or brake
      if (this.tier === 'legend' || (this.tier === 'pro' && Math.random() < 0.7)) {
        drift = true;
        throttle = 0.85;
      } else {
        throttle = 0.4;
        brake = 0.45;
      }
    } else if (isOnStraight) {
      // Main straight high-speed launch
      throttle = 1.0;
      if (car.boostMeter > 30 && this.boostCooldown <= 0) {
        boost = true;
        this.boostCooldown = 1.5;
      }
    } else {
      throttle = speedThreshold;
      if (distToWp > 200 && Math.abs(angleDiff) < 0.12 && car.boostMeter > 45 && this.boostCooldown <= 0) {
        boost = true;
        this.boostCooldown = 2.0;
      }
    }

    return {
      throttle,
      brake,
      steer: this.steerSmoothing,
      drift,
      boost,
      horn: false,
    };
  }
}
