import { TrackData, SURFACE_TYPES, SURFACE_PROPERTIES } from '../tracks/track-data';

export type CarBodyType = 'sedan' | 'muscle' | 'buggy' | 'kart';

export interface CarStats {
  id: CarBodyType;
  name: string;
  topSpeed: number;        // max forward speed in px/s (e.g. 260 - 320)
  accel: number;           // acceleration force in px/s^2
  brakeForce: number;      // deceleration force when braking
  reverseSpeed: number;    // max reverse speed
  handling: number;        // turn rate in rad/s
  driftHandling: number;   // turn rate while drifting
  baseGrip: number;        // lateral friction coefficient (0.92 - 0.96)
  weight: number;          // inertia
  offRoadGripMultiplier: number; // buggy gets bonus on grass
}

export const CAR_BODIES: Record<CarBodyType, CarStats> = {
  sedan: {
    id: 'sedan',
    name: 'Apex GT',
    topSpeed: 280,
    accel: 220,
    brakeForce: 280,
    reverseSpeed: 90,
    handling: 3.2,
    driftHandling: 3.8,
    baseGrip: 0.94,
    weight: 1.0,
    offRoadGripMultiplier: 1.0,
  },
  muscle: {
    id: 'muscle',
    name: 'V8 Thunderbolt',
    topSpeed: 320,
    accel: 250,
    brakeForce: 250,
    reverseSpeed: 80,
    handling: 2.8,
    driftHandling: 3.4,
    baseGrip: 0.88,
    weight: 1.2,
    offRoadGripMultiplier: 0.9,
  },
  buggy: {
    id: 'buggy',
    name: 'Dune Hopper',
    topSpeed: 260,
    accel: 240,
    brakeForce: 300,
    reverseSpeed: 100,
    handling: 3.4,
    driftHandling: 4.0,
    baseGrip: 0.92,
    weight: 0.85,
    offRoadGripMultiplier: 1.35,
  },
  kart: {
    id: 'kart',
    name: 'Turbo Kart',
    topSpeed: 250,
    accel: 260,
    brakeForce: 320,
    reverseSpeed: 110,
    handling: 4.2,
    driftHandling: 4.8,
    baseGrip: 0.96,
    weight: 0.7,
    offRoadGripMultiplier: 0.85,
  },
};

export interface CarCustomization {
  bodyId: CarBodyType;
  primaryColor: string;
  secondaryColor: string;
  decal: 'none' | 'stripe' | 'flame' | 'star' | 'number';
  raceNumber: number;
  hornId: number;
  trailId: number;
  displayName: string;
}

export const DEFAULT_CAR_CUSTOMIZATION: CarCustomization = {
  bodyId: 'sedan',
  primaryColor: '#FF3D00',
  secondaryColor: '#00E5FF',
  decal: 'stripe',
  raceNumber: 7,
  hornId: 1,
  trailId: 1,
  displayName: 'Racer 1',
};

export interface CarInputState {
  throttle: number; // 0 to 1
  brake: number;    // 0 to 1
  steer: number;    // -1 (left) to 1 (right)
  drift: boolean;   // drift button held
  boost: boolean;   // boost button held
  horn: boolean;    // horn button
}

export interface CarState {
  id: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  angle: number;       // heading in radians
  prevAngle: number;
  velocity: number;    // current longitudinal speed
  lateralVel: number;  // sliding speed
  isDrifting: boolean;
  driftCharge: number; // 0 to 100
  boostActive: boolean;
  boostTimer: number;  // remaining boost time in seconds
  boostMeter: number;  // available boost meter 0 to 100
  isOffRoad: boolean;
  currentLap: number;
  checkpointIndex: number;
  raceProgress: number;// 0 to 100% total progress towards finish line
  lapTimes: number[];
  currentLapTime: number;
  bestLapTime: number | null;
  totalTime: number;
  isFinished: boolean;
  finishPosition: number | null;
  surface: number;     // current track surface
  stats: CarStats;
  customization: CarCustomization;
  isAI: boolean;
  aiTier?: 'rookie' | 'pro' | 'legend';
}

export function createCarState(
  id: string,
  spawn: { x: number; y: number; angle: number },
  customization: CarCustomization = DEFAULT_CAR_CUSTOMIZATION,
  isAI = false,
  aiTier: 'rookie' | 'pro' | 'legend' = 'pro'
): CarState {
  const stats = CAR_BODIES[customization.bodyId] || CAR_BODIES.sedan;
  return {
    id,
    x: spawn.x,
    y: spawn.y,
    prevX: spawn.x,
    prevY: spawn.y,
    angle: spawn.angle,
    prevAngle: spawn.angle,
    velocity: 0,
    lateralVel: 0,
    isDrifting: false,
    driftCharge: 0,
    boostActive: false,
    boostTimer: 0,
    boostMeter: 60, // start with generous boost meter
    isOffRoad: false,
    currentLap: 1,
    checkpointIndex: 0,
    raceProgress: 0,
    lapTimes: [],
    currentLapTime: 0,
    bestLapTime: null,
    totalTime: 0,
    isFinished: false,
    finishPosition: null,
    surface: SURFACE_TYPES.TRACK,
    stats,
    customization,
    isAI,
    aiTier,
  };
}

export function updateCarPhysics(
  car: CarState,
  input: CarInputState,
  track: TrackData,
  dt: number,
  onLapComplete?: (car: CarState, lap: number, lapTime: number) => void,
  onNitroCollected?: (car: CarState, pickupId: string) => void
): void {
  // Store previous state for sub-tick render interpolation
  car.prevX = car.x;
  car.prevY = car.y;
  car.prevAngle = car.angle;

  if (car.isFinished) {
    // Decelerate to stop smoothly
    car.velocity *= Math.pow(0.95, dt * 60);
    car.lateralVel *= Math.pow(0.90, dt * 60);
    car.x += Math.cos(car.angle) * car.velocity * dt;
    car.y += Math.sin(car.angle) * car.velocity * dt;
    return;
  }

  // Update timers
  car.currentLapTime += dt;
  car.totalTime += dt;

  // 1. Surface sampling & Off-Road Detection
  const tileCol = Math.floor(car.x / track.tileSize);
  const tileRow = Math.floor(car.y / track.tileSize);
  let surface: number = SURFACE_TYPES.TRACK;

  if (
    tileRow >= 0 &&
    tileRow < track.rows &&
    tileCol >= 0 &&
    tileCol < track.cols
  ) {
    surface = track.tiles[tileRow][tileCol];
  } else {
    surface = SURFACE_TYPES.GRASS;
  }
  car.surface = surface;
  car.isOffRoad = surface === SURFACE_TYPES.GRASS;

  // Handle boost pad surface trigger
  if (surface === SURFACE_TYPES.BOOST && car.boostTimer <= 0.2) {
    car.boostActive = true;
    car.boostTimer = 1.0;
  }

  // 2. 3D Nitro Gas Pickups Collection Detection (Asphalt 2x Boost Pickups!)
  if (track.nitroPickups && track.nitroPickups.length > 0) {
    track.nitroPickups.forEach((pickup) => {
      // Countdown respawn timer
      if (!pickup.active && pickup.respawnTimer > 0) {
        pickup.respawnTimer -= dt;
        if (pickup.respawnTimer <= 0) {
          pickup.active = true;
          pickup.respawnTimer = 0;
        }
      }

      if (pickup.active) {
        const dist = Math.hypot(car.x - pickup.x, car.y - pickup.y);
        if (dist < 40) {
          // Collected!
          pickup.active = false;
          pickup.respawnTimer = 12.0; // 12s respawn cooldown

          car.boostMeter = 100;       // Fill nitro tank
          car.boostActive = true;
          car.boostTimer = 2.5;       // 2.5s sustained 2x Super Nitro Boost!

          onNitroCollected?.(car, pickup.id);
        }
      }
    });
  }

  const surfaceProp = SURFACE_PROPERTIES[surface as keyof typeof SURFACE_PROPERTIES] || SURFACE_PROPERTIES[SURFACE_TYPES.TRACK];
  let surfaceGrip = surfaceProp.grip;
  if (surface === SURFACE_TYPES.GRASS && car.stats.offRoadGripMultiplier > 1.0) {
    surfaceGrip *= car.stats.offRoadGripMultiplier;
  }
  const speedMult = surfaceProp.speedMult;

  // 3. 2x Super Nitro Boost Mechanic (Asphalt Style)
  if (input.boost && car.boostMeter > 10 && !car.boostActive) {
    car.boostActive = true;
    car.boostTimer = 2.0;
  }

  let topSpeed = car.stats.topSpeed * speedMult;

  if (car.boostActive) {
    // 2x Super Nitro Boost multiplier!
    topSpeed *= 2.0;
    // Instant aggressive nitro acceleration thrust
    car.velocity += car.stats.accel * 2.5 * dt;

    car.boostTimer -= dt;
    car.boostMeter = Math.max(0, car.boostMeter - dt * 25);
    if (car.boostTimer <= 0 || car.boostMeter <= 0) {
      car.boostActive = false;
      car.boostTimer = 0;
    }
  }

  // 4. Drift state
  // Hold brake + steer at speed initiates drift
  const wantsDrift = input.drift || (input.brake > 0.3 && Math.abs(input.steer) > 0.3);
  const minDriftSpeed = car.stats.topSpeed * 0.30;
  const canDrift = Math.abs(car.velocity) > minDriftSpeed;

  if (wantsDrift && canDrift) {
    car.isDrifting = true;
    // Grip drops significantly during drift (0.95 -> 0.55)
    surfaceGrip *= 0.60;
    car.driftCharge += dt * 40;
    // Award boost meter while sustaining drift
    car.boostMeter = Math.min(100, car.boostMeter + dt * 25);
  } else {
    if (car.isDrifting && car.driftCharge > 30) {
      // Small drift boost award on release!
      car.boostMeter = Math.min(100, car.boostMeter + 15);
    }
    car.isDrifting = false;
    car.driftCharge = 0;
  }

  // 5. Longitudinal Forces (Throttle, Brake, Coasting drag)
  const drag = car.isOffRoad ? 0.94 : 0.985;
  const rollingResistance = car.isOffRoad ? 50 : 18;

  if (input.throttle > 0) {
    const accelCurve = Math.max(0.18, 1 - car.velocity / topSpeed);
    car.velocity += car.stats.accel * input.throttle * accelCurve * dt;
  } else if (input.brake > 0) {
    if (car.velocity > 5) {
      car.velocity -= car.stats.brakeForce * input.brake * dt;
    } else {
      // Reverse
      car.velocity -= car.stats.accel * 0.5 * input.brake * dt;
      if (car.velocity < -car.stats.reverseSpeed) {
        car.velocity = -car.stats.reverseSpeed;
      }
    }
  } else {
    // Natural drag and rolling resistance
    car.velocity *= Math.pow(drag, dt * 60);
    if (Math.abs(car.velocity) > 0) {
      const sign = Math.sign(car.velocity);
      car.velocity -= sign * rollingResistance * dt;
      if (sign > 0 && car.velocity < 0) car.velocity = 0;
      if (sign < 0 && car.velocity > 0) car.velocity = 0;
    }
  }

  if (car.velocity > topSpeed && !car.boostActive) {
    car.velocity = Math.max(topSpeed, car.velocity - car.stats.accel * 0.8 * dt);
  }

  // 6. Steering & Lateral Dynamics
  const speedRatio = Math.min(1.0, Math.abs(car.velocity) / (car.stats.topSpeed * 0.5));
  const turnRate = (car.isDrifting ? car.stats.driftHandling : car.stats.handling) * speedRatio;

  if (Math.abs(input.steer) > 0.05) {
    const steerDir = Math.sign(car.velocity) >= 0 ? input.steer : -input.steer;
    car.angle += steerDir * turnRate * dt;
  }

  // Lateral slide velocity
  const latDecay = Math.pow(surfaceGrip, dt * 60);
  car.lateralVel *= latDecay;

  if (car.isDrifting) {
    const slipAngle = input.steer * (car.velocity * 0.18);
    car.lateralVel = slipAngle;
  }

  // 7. Velocity Vector to Global Coordinates
  const forwardX = Math.cos(car.angle) * car.velocity;
  const forwardY = Math.sin(car.angle) * car.velocity;

  const rightAngle = car.angle + Math.PI / 2;
  const slideX = Math.cos(rightAngle) * car.lateralVel;
  const slideY = Math.sin(rightAngle) * car.lateralVel;

  const nextX = car.x + (forwardX + slideX) * dt;
  const nextY = car.y + (forwardY + slideY) * dt;

  // 8. Wall Collision with Restitution
  const nextCol = Math.floor(nextX / track.tileSize);
  const nextRow = Math.floor(nextY / track.tileSize);

  let collided = false;
  if (
    nextRow >= 0 &&
    nextRow < track.rows &&
    nextCol >= 0 &&
    nextCol < track.cols
  ) {
    if (track.tiles[nextRow][nextCol] === SURFACE_TYPES.WALL) {
      collided = true;
    }
  } else {
    collided = true;
  }

  if (collided) {
    // Bounce back with restitution and velocity loss
    car.velocity *= -0.35;
    car.lateralVel = 0;
  } else {
    car.x = nextX;
    car.y = nextY;
  }

  // 9. Checkpoints, Lap Detection & Continuous 0-100% Progress Calculation
  updateCheckpoints(car, track, onLapComplete);
}

function updateCheckpoints(
  car: CarState,
  track: TrackData,
  onLapComplete?: (car: CarState, lap: number, lapTime: number) => void
): void {
  if (car.isFinished || track.checkpoints.length === 0) return;

  const numCp = track.checkpoints.length;
  const nextCpIndex = (car.checkpointIndex + 1) % numCp;
  const cp = track.checkpoints[nextCpIndex];

  // Continuous Progress 0 to 100%
  const lapFraction = (car.checkpointIndex / numCp);
  const totalLaps = Math.max(1, track.lapsDefault);
  const overallProgress = ((car.currentLap - 1) + lapFraction) / totalLaps;
  car.raceProgress = Math.min(100, Math.max(0, Math.round(overallProgress * 100)));

  // Line segment intersection between car movement (prevX, prevY) -> (x, y) and checkpoint segment
  if (lineIntersects(car.prevX, car.prevY, car.x, car.y, cp.x1, cp.y1, cp.x2, cp.y2)) {
    car.checkpointIndex = nextCpIndex;

    // Lap completed when crossing checkpoint 0
    if (nextCpIndex === 0) {
      const lapTime = car.currentLapTime;
      car.lapTimes.push(lapTime);

      if (car.bestLapTime === null || lapTime < car.bestLapTime) {
        car.bestLapTime = lapTime;
      }

      onLapComplete?.(car, car.currentLap, lapTime);

      if (car.currentLap >= track.lapsDefault) {
        car.isFinished = true;
        car.raceProgress = 100;
      } else {
        car.currentLap += 1;
        car.currentLapTime = 0;
      }
    }
  }
}

// 2D line-line intersection test
function lineIntersects(
  p0_x: number, p0_y: number, p1_x: number, p1_y: number,
  p2_x: number, p2_y: number, p3_x: number, p3_y: number
): boolean {
  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;

  const s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
  const t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);

  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}
