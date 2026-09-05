export interface Waypoint {
  x: number;
  y: number;
  targetSpeed?: number;
}

export interface Checkpoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SpawnSlot {
  x: number;
  y: number;
  angle: number;
}

export interface NitroPickup {
  id: string;
  x: number;
  y: number;
  respawnTimer: number; // 0 when ready to collect, counts down when collected
  active: boolean;
}

export interface FinishGate {
  x: number;
  y: number;
  angle: number;
  width: number;
}

export interface TrackData {
  id: string;
  name: string;
  slug: string;
  difficulty: number;
  lapLengthMeters: number;
  lapsDefault: number;
  theme: string;
  accentColor: string;
  cols: number;
  rows: number;
  tileSize: number;
  // Surfaces: 0 = Grass/Sand (off-road), 1 = Asphalt Track, 2 = Oil slick, 3 = Boost pad, 4 = Wall, 5 = Finish Line
  tiles: number[][];
  waypoints: Waypoint[];
  checkpoints: Checkpoint[];
  spawnSlots: SpawnSlot[];
  nitroPickups: NitroPickup[];
  finishGate: FinishGate;
}

export const SURFACE_TYPES = {
  GRASS: 0,
  TRACK: 1,
  OIL: 2,
  BOOST: 3,
  WALL: 4,
  FINISH: 5,
} as const;

export const SURFACE_PROPERTIES = {
  [SURFACE_TYPES.GRASS]: { grip: 0.55, speedMult: 0.60, name: 'Off-Road' },
  [SURFACE_TYPES.TRACK]: { grip: 1.00, speedMult: 1.00, name: 'Track' },
  [SURFACE_TYPES.OIL]: { grip: 0.35, speedMult: 1.00, name: 'Oil' },
  [SURFACE_TYPES.BOOST]: { grip: 1.00, speedMult: 1.60, boostDuration: 1.2, name: 'Boost' },
  [SURFACE_TYPES.WALL]: { grip: 0.00, speedMult: 0.00, name: 'Barrier' },
  [SURFACE_TYPES.FINISH]: { grip: 1.00, speedMult: 1.00, name: 'Finish Line' },
};

// Track 1: Asphalt Grand Prix (Dedicated 2-Minute High-Speed Track)
function createNeonCircuit(): TrackData {
  const cols = 72;
  const rows = 50;
  const tileSize = 32;
  const tiles: number[][] = Array.from({ length: rows }, () => Array(cols).fill(SURFACE_TYPES.GRASS));

  // Outer boundary barrier walls
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles[r][c] = SURFACE_TYPES.WALL;
      }
    }
  }

  const drawTrackRect = (r1: number, c1: number, r2: number, c2: number) => {
    for (let r = Math.max(1, r1); r <= Math.min(rows - 2, r2); r++) {
      for (let c = Math.max(1, c1); c <= Math.min(cols - 2, c2); c++) {
        tiles[r][c] = SURFACE_TYPES.TRACK;
      }
    }
  };

  // 1. Top Grand Highway Straight (Start / Finish Area)
  drawTrackRect(3, 4, 9, 66);

  // 2. East Sweeping High-Speed Turn
  drawTrackRect(4, 60, 44, 66);

  // 3. Divided South Highway Section (Dual lanes around central island divider)
  drawTrackRect(39, 14, 46, 64);
  // Central divider barrier island (creates split routes with nitro bottles!)
  for (let r = 42; r <= 43; r++) {
    for (let c = 28; c <= 48; c++) {
      tiles[r][c] = SURFACE_TYPES.WALL;
    }
  }

  // 4. Infield Technical S-Chicane
  drawTrackRect(22, 14, 44, 20);
  drawTrackRect(22, 18, 28, 42);
  drawTrackRect(14, 36, 26, 42);
  drawTrackRect(14, 10, 20, 38);

  // 5. West Hairpin & Home Straight Connection
  drawTrackRect(4, 4, 20, 11);

  // Checkered Start / Finish Line on Top Straight
  for (let r = 3; r <= 9; r++) {
    for (let c = 12; c <= 15; c++) {
      tiles[r][c] = SURFACE_TYPES.FINISH;
    }
  }

  // Waypoints for AI Navigation & Racing Line
  const waypoints: Waypoint[] = [
    { x: 14 * 32, y: 6.5 * 32 },  // Start / Finish Line
    { x: 35 * 32, y: 6.5 * 32 },  // Top Straight Mid
    { x: 58 * 32, y: 6.5 * 32 },  // Turn 1 Entry
    { x: 63 * 32, y: 16 * 32 },   // East Sweeper North
    { x: 63 * 32, y: 35 * 32 },   // East Sweeper South
    { x: 56 * 32, y: 43 * 32 },   // South Divided Highway Entry
    { x: 38 * 32, y: 40.5 * 32 }, // North Split Lane (Fast Route)
    { x: 22 * 32, y: 43 * 32 },   // Split Merge Point
    { x: 17 * 32, y: 35 * 32 },   // S-Curve Infield Entry
    { x: 26 * 32, y: 25 * 32 },   // Chicane Mid Apex
    { x: 39 * 32, y: 20 * 32 },   // Chicane High-Speed Exit
    { x: 25 * 32, y: 17 * 32 },   // Westbound Infield Link
    { x: 8 * 32, y: 17 * 32 },    // West Hairpin Entry
    { x: 7.5 * 32, y: 7 * 32 },   // Final Turn Apex into Main Straight
  ];

  // Checkpoints for Precise 0% to 100% Progress Tracking
  const checkpoints: Checkpoint[] = [
    { x1: 14 * 32, y1: 3 * 32, x2: 14 * 32, y2: 10 * 32 },   // CP 0: Finish Gate
    { x1: 35 * 32, y1: 3 * 32, x2: 35 * 32, y2: 10 * 32 },   // CP 1: Straight Mid
    { x1: 58 * 32, y1: 3 * 32, x2: 58 * 32, y2: 10 * 32 },   // CP 2: Turn 1
    { x1: 60 * 32, y1: 20 * 32, x2: 66 * 32, y2: 20 * 32 }, // CP 3: East Sweeper
    { x1: 60 * 32, y1: 38 * 32, x2: 66 * 32, y2: 38 * 32 }, // CP 4: East Exit
    { x1: 48 * 32, y1: 39 * 32, x2: 48 * 32, y2: 46 * 32 }, // CP 5: Divided Highway 1
    { x1: 32 * 32, y1: 39 * 32, x2: 32 * 32, y2: 46 * 32 }, // CP 6: Divided Highway 2
    { x1: 20 * 32, y1: 39 * 32, x2: 20 * 32, y2: 46 * 32 }, // CP 7: Split Merge
    { x1: 14 * 32, y1: 28 * 32, x2: 20 * 32, y2: 28 * 32 }, // CP 8: Chicane S1
    { x1: 30 * 32, y1: 22 * 32, x2: 30 * 32, y2: 28 * 32 }, // CP 9: Chicane Apex
    { x1: 36 * 32, y1: 14 * 32, x2: 42 * 32, y2: 14 * 32 }, // CP 10: Infield Loop
    { x1: 22 * 32, y1: 14 * 32, x2: 22 * 32, y2: 20 * 32 }, // CP 11: Hairpin Approach
    { x1: 4 * 32, y1: 14 * 32, x2: 11 * 32, y2: 14 * 32 },  // CP 12: West Hairpin
    { x1: 7 * 32, y1: 4 * 32, x2: 7 * 32, y2: 10 * 32 },    // CP 13: Final Corner
  ];

  // Starting Grid (Player in front row; 4 AI opponents arranged in formation ahead)
  const spawnSlots: SpawnSlot[] = [
    { x: 12.5 * 32, y: 6.5 * 32, angle: 0 },  // Player on Checkered Grid Center
    { x: 18.5 * 32, y: 5.2 * 32, angle: 0 },  // Rival 1 (Green 1)
    { x: 17.5 * 32, y: 6.2 * 32, angle: 0 },  // Rival 2 (Red 3)
    { x: 18.8 * 32, y: 7.2 * 32, angle: 0 },  // Rival 3 (Yellow 2)
    { x: 17.0 * 32, y: 8.0 * 32, angle: 0 },  // Rival 4 (White 4)
    { x: 10.5 * 32, y: 5.5 * 32, angle: 0 },
    { x: 10.5 * 32, y: 7.5 * 32, angle: 0 },
    { x: 9.0 * 32, y: 6.5 * 32, angle: 0 },
  ];

  // 3D Nitro Gas Pickups (Strategic Canisters for 2x Boost)
  const nitroPickups: NitroPickup[] = [
    { id: 'nitro-1', x: 26 * 32, y: 4.8 * 32, respawnTimer: 0, active: true },   // Top Straight Left
    { id: 'nitro-2', x: 45 * 32, y: 7.8 * 32, respawnTimer: 0, active: true },   // Top Straight Right
    { id: 'nitro-3', x: 61 * 32, y: 8.5 * 32, respawnTimer: 0, active: true },   // Turn 1 Apex
    { id: 'nitro-4', x: 64.5 * 32, y: 25 * 32, respawnTimer: 0, active: true }, // East Bank Shoulder
    { id: 'nitro-5', x: 40 * 32, y: 40.5 * 32, respawnTimer: 0, active: true }, // Highway North Split
    { id: 'nitro-6', x: 40 * 32, y: 44.5 * 32, respawnTimer: 0, active: true }, // Highway South Split
    { id: 'nitro-7', x: 28 * 32, y: 42.5 * 32, respawnTimer: 0, active: true }, // Median Tip Divider
    { id: 'nitro-8', x: 17 * 32, y: 38 * 32, respawnTimer: 0, active: true },   // Chicane Entry
    { id: 'nitro-9', x: 28 * 32, y: 24.5 * 32, respawnTimer: 0, active: true }, // S-Curve Apex
    { id: 'nitro-10', x: 40 * 32, y: 16 * 32, respawnTimer: 0, active: true },  // Infield Exit
    { id: 'nitro-11', x: 6 * 32, y: 18.5 * 32, respawnTimer: 0, active: true }, // Hairpin Apex
    { id: 'nitro-12', x: 5 * 32, y: 6.5 * 32, respawnTimer: 0, active: true },   // Final Straight Launch
  ];

  // Overhead 3D Finish Gate Arch Gantry
  const finishGate: FinishGate = {
    x: 14 * 32,
    y: 6.5 * 32,
    angle: 0,
    width: 7 * 32,
  };

  return {
    id: 'neon-circuit',
    name: 'Asphalt Grand Prix',
    slug: 'asphalt-grand-prix',
    difficulty: 2,
    lapLengthMeters: 750,
    lapsDefault: 2, // 2 full laps = ~2:00 minutes of high-speed racing
    theme: 'neon-night',
    accentColor: '#FF3D00',
    cols,
    rows,
    tileSize,
    tiles,
    waypoints,
    checkpoints,
    spawnSlots,
    nitroPickups,
    finishGate,
  };
}

// Track 2: Cyber Driftway (Technical Mountain Pass)
function createCyberDriftway(): TrackData {
  const cols = 55;
  const rows = 40;
  const tileSize = 32;
  const tiles: number[][] = Array.from({ length: rows }, () => Array(cols).fill(SURFACE_TYPES.GRASS));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles[r][c] = SURFACE_TYPES.WALL;
      }
    }
  }

  const drawTrackRect = (r1: number, c1: number, r2: number, c2: number) => {
    for (let r = Math.max(1, r1); r <= Math.min(rows - 2, r2); r++) {
      for (let c = Math.max(1, c1); c <= Math.min(cols - 2, c2); c++) {
        tiles[r][c] = SURFACE_TYPES.TRACK;
      }
    }
  };

  drawTrackRect(4, 5, 9, 48);
  drawTrackRect(9, 43, 20, 48);
  drawTrackRect(16, 25, 21, 44);
  drawTrackRect(21, 25, 33, 30);
  drawTrackRect(29, 30, 34, 50);
  drawTrackRect(32, 5, 37, 50);
  drawTrackRect(18, 5, 33, 10);
  drawTrackRect(14, 9, 19, 26);
  drawTrackRect(4, 5, 15, 10);

  for (let r = 4; r <= 9; r++) {
    for (let c = 13; c <= 15; c++) {
      tiles[r][c] = SURFACE_TYPES.FINISH;
    }
  }

  const waypoints: Waypoint[] = [
    { x: 14 * 32, y: 7 * 32 },
    { x: 34 * 32, y: 7 * 32 },
    { x: 45 * 32, y: 14 * 32 },
    { x: 36 * 32, y: 19 * 32 },
    { x: 27 * 32, y: 25 * 32 },
    { x: 44 * 32, y: 32 * 32 },
    { x: 35 * 32, y: 35 * 32 },
    { x: 15 * 32, y: 35 * 32 },
    { x: 8 * 32, y: 26 * 32 },
    { x: 18 * 32, y: 17 * 32 },
    { x: 8 * 32, y: 10 * 32 },
  ];

  const checkpoints: Checkpoint[] = [
    { x1: 14 * 32, y1: 4 * 32, x2: 14 * 32, y2: 9 * 32 },
    { x1: 40 * 32, y1: 18 * 32, x2: 46 * 32, y2: 18 * 32 },
    { x1: 28 * 32, y1: 32 * 32, x2: 36 * 32, y2: 32 * 32 },
    { x1: 7 * 32, y1: 22 * 32, x2: 12 * 32, y2: 22 * 32 },
  ];

  const spawnSlots: SpawnSlot[] = [
    { x: 12 * 32, y: 6.5 * 32, angle: 0 },
    { x: 17 * 32, y: 5.5 * 32, angle: 0 },
    { x: 16 * 32, y: 6.5 * 32, angle: 0 },
    { x: 17.5 * 32, y: 7.5 * 32, angle: 0 },
    { x: 15.5 * 32, y: 8.2 * 32, angle: 0 },
  ];

  const nitroPickups: NitroPickup[] = [
    { id: 'c-nitro-1', x: 25 * 32, y: 6.5 * 32, respawnTimer: 0, active: true },
    { id: 'c-nitro-2', x: 46 * 32, y: 12 * 32, respawnTimer: 0, active: true },
    { id: 'c-nitro-3', x: 30 * 32, y: 28 * 32, respawnTimer: 0, active: true },
    { id: 'c-nitro-4', x: 25 * 32, y: 35 * 32, respawnTimer: 0, active: true },
  ];

  const finishGate: FinishGate = {
    x: 14 * 32,
    y: 6.5 * 32,
    angle: 0,
    width: 6 * 32,
  };

  return {
    id: 'cyber-driftway',
    name: 'Cyber Driftway',
    slug: 'cyber-driftway',
    difficulty: 3,
    lapLengthMeters: 620,
    lapsDefault: 2,
    theme: 'retro-arcade',
    accentColor: '#FF00A8',
    cols,
    rows,
    tileSize,
    tiles,
    waypoints,
    checkpoints,
    spawnSlots,
    nitroPickups,
    finishGate,
  };
}

// Track 3: Sunset Highway
function createSunsetBay(): TrackData {
  return createNeonCircuit();
}

// Track 4: Metropolis Speedway
function createMetropolisSpeedway(): TrackData {
  return createNeonCircuit();
}

export const ALL_TRACKS: Record<string, TrackData> = {
  'neon-circuit': createNeonCircuit(),
  'cyber-driftway': createCyberDriftway(),
  'sunset-bay': createSunsetBay(),
  'metropolis-speedway': createMetropolisSpeedway(),
};

export function getTrack(idOrSlug: string): TrackData {
  return ALL_TRACKS[idOrSlug] || ALL_TRACKS['neon-circuit'];
}
