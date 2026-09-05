import {
  WSClientMessage,
  WSServerMessage,
  RoomStateData,
  PlayerRoomInfo,
} from './protocol';

export class RoomClient {
  private ws: WebSocket | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private isConnected = false;
  private roomCode: string;
  private player: PlayerRoomInfo;

  public onRoomState?: (state: RoomStateData) => void;
  public onCountdown?: (count: number) => void;
  public onRaceStart?: (matchId: string) => void;

  constructor(roomCode: string, player: PlayerRoomInfo) {
    this.roomCode = roomCode.toUpperCase();
    this.player = player;
  }

  public connect() {
    if (typeof window === 'undefined') return;

    // 1. Setup BroadcastChannel fallback for multi-tab zero-infrastructure testing
    try {
      this.broadcastChannel = new BroadcastChannel(`pixel-racer-room-${this.roomCode}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (e) {}

    // 2. Attempt WebSocket connection
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.hostname}:3001`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({
          type: 'join',
          code: this.roomCode,
          player: this.player,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSServerMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {}
      };

      this.ws.onerror = () => {
        // Fall back to broadcast / local state
        this.fallbackJoin();
      };

      this.ws.onclose = () => {
        this.isConnected = false;
      };
    } catch (e) {
      this.fallbackJoin();
    }
  }

  private fallbackJoin() {
    // Read or init localStorage room
    const key = `pixel-room-${this.roomCode}`;
    let room: RoomStateData;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        room = JSON.parse(stored);
      } else {
        room = {
          code: this.roomCode,
          hostId: this.player.id,
          status: 'waiting',
          trackId: 'neon-circuit',
          laps: 3,
          players: [],
        };
      }

      const existingIdx = room.players.findIndex((p) => p.id === this.player.id);
      if (existingIdx >= 0) {
        room.players[existingIdx] = { ...this.player, isHost: room.hostId === this.player.id };
      } else {
        const slot = room.players.length;
        room.players.push({ ...this.player, slot, isHost: room.hostId === this.player.id });
      }

      localStorage.setItem(key, JSON.stringify(room));
      this.broadcastFallback({ type: 'room_state', room });
      this.onRoomState?.(room);
    } catch (e) {}
  }

  private handleMessage(msg: WSServerMessage) {
    if (msg.type === 'room_state') {
      this.onRoomState?.(msg.room);
    } else if (msg.type === 'countdown') {
      this.onCountdown?.(msg.count);
    } else if (msg.type === 'race_start') {
      this.onRaceStart?.(msg.matchId);
    }
  }

  public setReady(isReady: boolean) {
    if (this.ws && this.isConnected) {
      this.send({ type: 'ready', isReady });
    } else {
      const key = `pixel-room-${this.roomCode}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const room: RoomStateData = JSON.parse(stored);
        const p = room.players.find((pl) => pl.id === this.player.id);
        if (p) p.isReady = isReady;
        localStorage.setItem(key, JSON.stringify(room));
        this.broadcastFallback({ type: 'room_state', room });
        this.onRoomState?.(room);
      }
    }
  }

  public selectTrack(trackId: string) {
    if (this.ws && this.isConnected) {
      this.send({ type: 'select_track', trackId });
    } else {
      const key = `pixel-room-${this.roomCode}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const room: RoomStateData = JSON.parse(stored);
        room.trackId = trackId;
        localStorage.setItem(key, JSON.stringify(room));
        this.broadcastFallback({ type: 'room_state', room });
        this.onRoomState?.(room);
      }
    }
  }

  public startRace() {
    if (this.ws && this.isConnected) {
      this.send({ type: 'start_race' });
    } else {
      const key = `pixel-room-${this.roomCode}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const room: RoomStateData = JSON.parse(stored);
        room.status = 'countdown';
        localStorage.setItem(key, JSON.stringify(room));
        this.broadcastFallback({ type: 'room_state', room });
        this.onRoomState?.(room);

        let count = 3;
        const interval = setInterval(() => {
          if (count >= 0) {
            this.broadcastFallback({ type: 'countdown', count });
            this.onCountdown?.(count);
            count--;
          } else {
            clearInterval(interval);
            const matchId = `${this.roomCode}-${Date.now()}`;
            this.broadcastFallback({ type: 'race_start', matchId });
            this.onRaceStart?.(matchId);
          }
        }, 1000);
      }
    }
  }

  private send(msg: WSClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private broadcastFallback(msg: WSServerMessage) {
    this.broadcastChannel?.postMessage(msg);
  }

  public disconnect() {
    if (this.ws) {
      this.send({ type: 'leave' });
      this.ws.close();
      this.ws = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
}
