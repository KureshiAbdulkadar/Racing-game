import { CarCustomization, CarInputState } from '../physics/car-physics';

// Base32 character set avoiding confusing characters (0, O, 1, I, L)
const ROOM_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    code += ROOM_CODE_CHARS[idx];
  }
  return code;
}

export interface PlayerRoomInfo {
  id: string;
  slot: number;
  isHost: boolean;
  isReady: boolean;
  customization: CarCustomization;
}

export interface RoomStateData {
  code: string;
  hostId: string;
  status: 'waiting' | 'countdown' | 'racing' | 'finished';
  trackId: string;
  laps: number;
  players: PlayerRoomInfo[];
  countdown?: number;
}

export interface ClientInputPacket {
  seq: number;
  input: CarInputState;
  timestamp: number;
}

export interface CarSnapshot {
  id: string;
  x: number;
  y: number;
  angle: number;
  velocity: number;
  isDrifting: boolean;
  boostActive: boolean;
  currentLap: number;
  checkpointIndex: number;
}

export interface WorldSnapshotPacket {
  seq: number;
  timestamp: number;
  cars: CarSnapshot[];
}

export type WSClientMessage =
  | { type: 'join'; code: string; player: PlayerRoomInfo }
  | { type: 'ready'; isReady: boolean }
  | { type: 'select_track'; trackId: string }
  | { type: 'start_race' }
  | { type: 'input'; data: ClientInputPacket }
  | { type: 'leave' };

export type WSServerMessage =
  | { type: 'room_state'; room: RoomStateData }
  | { type: 'countdown'; count: number }
  | { type: 'race_start'; matchId: string }
  | { type: 'snapshot'; data: WorldSnapshotPacket }
  | { type: 'player_finished'; playerId: string; position: number; totalTime: number }
  | { type: 'error'; message: string };
