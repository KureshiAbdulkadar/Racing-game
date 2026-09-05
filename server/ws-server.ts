import { WebSocketServer, WebSocket } from 'ws';
import {
  WSClientMessage,
  WSServerMessage,
  RoomStateData,
  PlayerRoomInfo,
  generateRoomCode,
} from '../game/netcode/protocol';

interface ConnectedClient {
  ws: WebSocket;
  playerId: string;
  roomCode: string | null;
}

const PORT = parseInt(process.env.WS_PORT || '3001', 10);
const wss = new WebSocketServer({ port: PORT });
console.log(`[Pixel Racer WS Server] Running on ws://localhost:${PORT}`);

const rooms = new Map<string, RoomStateData>();
const clients = new Map<WebSocket, ConnectedClient>();

function broadcastToRoom(code: string, msg: WSServerMessage) {
  const payload = JSON.stringify(msg);
  clients.forEach((client) => {
    if (client.roomCode === code && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  const client: ConnectedClient = { ws, playerId: '', roomCode: null };
  clients.set(ws, client);

  ws.on('message', (raw) => {
    try {
      const msg: WSClientMessage = JSON.parse(raw.toString());

      if (msg.type === 'join') {
        const code = msg.code.toUpperCase();
        client.playerId = msg.player.id;
        client.roomCode = code;

        let room = rooms.get(code);
        if (!room) {
          // Create room with this player as host
          room = {
            code,
            hostId: msg.player.id,
            status: 'waiting',
            trackId: 'neon-circuit',
            laps: 3,
            players: [],
          };
          rooms.set(code, room);
        }

        // Add or update player
        const existingIdx = room.players.findIndex((p) => p.id === msg.player.id);
        const slot = existingIdx >= 0 ? room.players[existingIdx].slot : room.players.length;
        const playerInfo: PlayerRoomInfo = {
          ...msg.player,
          slot,
          isHost: room.hostId === msg.player.id,
        };

        if (existingIdx >= 0) {
          room.players[existingIdx] = playerInfo;
        } else if (room.players.length < 8) {
          room.players.push(playerInfo);
        }

        broadcastToRoom(code, { type: 'room_state', room });
      }

      if (msg.type === 'ready' && client.roomCode) {
        const room = rooms.get(client.roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === client.playerId);
          if (player) {
            player.isReady = msg.isReady;
            broadcastToRoom(client.roomCode, { type: 'room_state', room });
          }
        }
      }

      if (msg.type === 'select_track' && client.roomCode) {
        const room = rooms.get(client.roomCode);
        if (room && room.hostId === client.playerId) {
          room.trackId = msg.trackId;
          broadcastToRoom(client.roomCode, { type: 'room_state', room });
        }
      }

      if (msg.type === 'start_race' && client.roomCode) {
        const room = rooms.get(client.roomCode);
        if (room && room.hostId === client.playerId) {
          room.status = 'countdown';
          broadcastToRoom(client.roomCode, { type: 'room_state', room });

          // Start 3-2-1 countdown
          let count = 3;
          const interval = setInterval(() => {
            if (count >= 0) {
              broadcastToRoom(client.roomCode!, { type: 'countdown', count });
              count--;
            } else {
              clearInterval(interval);
              room.status = 'racing';
              broadcastToRoom(client.roomCode!, {
                type: 'race_start',
                matchId: `${client.roomCode}-${Date.now()}`,
              });
            }
          }, 1000);
        }
      }

      if (msg.type === 'leave' && client.roomCode) {
        handleClientLeave(client);
      }
    } catch (err) {
      console.error('[WS Error]', err);
    }
  });

  ws.on('close', () => {
    handleClientLeave(client);
    clients.delete(ws);
  });
});

function handleClientLeave(client: ConnectedClient) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;

  room.players = room.players.filter((p) => p.id !== client.playerId);
  if (room.players.length === 0) {
    rooms.delete(client.roomCode);
  } else {
    if (room.hostId === client.playerId) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }
    broadcastToRoom(client.roomCode, { type: 'room_state', room });
  }
  client.roomCode = null;
}
