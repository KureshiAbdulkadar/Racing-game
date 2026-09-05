import {
  pgTable,
  uuid,
  varchar,
  smallint,
  boolean,
  integer,
  timestamp,
  text,
  char,
  jsonb,
  bigint,
  bigserial,
  pgEnum,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const roomStatusEnum = pgEnum('room_status', [
  'waiting',
  'countdown',
  'racing',
  'finished',
  'closed',
]);

// 1. Users & Auth
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique(),
  displayName: varchar('display_name', { length: 16 }).notNull(),
  avatarHue: smallint('avatar_hue').default(0).notNull(),
  isGuest: boolean('is_guest').default(true).notNull(),
  xp: integer('xp').default(0).notNull(),
  level: smallint('level').default(1).notNull(),
  preferredTheme: varchar('preferred_theme', { length: 24 }).default('neon-night').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_users_last_seen').on(table.lastSeenAt),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Cars & Customization
export const carBodies = pgTable('car_bodies', {
  id: smallint('id').primaryKey(),
  slug: varchar('slug', { length: 24 }).unique().notNull(),
  topSpeed: smallint('top_speed').notNull(),
  accel: smallint('accel').notNull(),
  handling: smallint('handling').notNull(),
  weight: smallint('weight').notNull(),
  unlockLevel: smallint('unlock_level').default(1).notNull(),
});

export const decals = pgTable('decals', {
  id: smallint('id').primaryKey(),
  slug: varchar('slug', { length: 24 }).unique().notNull(),
  unlockLevel: smallint('unlock_level').default(1).notNull(),
});

export const playerCars = pgTable('player_cars', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bodyId: smallint('body_id').notNull().references(() => carBodies.id),
  primaryHex: char('primary_hex', { length: 7 }).notNull(),
  secondaryHex: char('secondary_hex', { length: 7 }).notNull(),
  decalId: smallint('decal_id').references(() => decals.id),
  raceNumber: smallint('race_number').notNull(),
  hornId: smallint('horn_id').default(1).notNull(),
  trailId: smallint('trail_id'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Tracks
export const tracks = pgTable('tracks', {
  id: smallint('id').primaryKey(),
  slug: varchar('slug', { length: 32 }).unique().notNull(),
  displayName: varchar('display_name', { length: 48 }).notNull(),
  difficulty: smallint('difficulty').notNull(),
  lapLengthM: integer('lap_length_m').notNull(),
  lapsDefault: smallint('laps_default').default(3).notNull(),
  dataJson: jsonb('data_json').notNull(),
});

// 4. Rooms & Matches
export const rooms = pgTable('rooms', {
  code: char('code', { length: 6 }).primaryKey(),
  hostUserId: uuid('host_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: roomStatusEnum('status').default('waiting').notNull(),
  trackId: smallint('track_id').references(() => tracks.id),
  laps: smallint('laps').default(3).notNull(),
  maxPlayers: smallint('max_players').default(8).notNull(),
  isPrivate: boolean('is_private').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActivity: timestamp('last_activity', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_rooms_last_activity').on(table.lastActivity),
]);

export const roomPlayers = pgTable('room_players', {
  roomCode: char('room_code', { length: 6 }).notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  carId: uuid('car_id').notNull().references(() => playerCars.id),
  slot: smallint('slot').notNull(),
  isReady: boolean('is_ready').default(false).notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.roomCode, table.userId] }),
]);

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomCode: char('room_code', { length: 6 }).notNull().references(() => rooms.code, { onDelete: 'cascade' }),
  trackId: smallint('track_id').notNull().references(() => tracks.id),
  laps: smallint('laps').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  seed: bigint('seed', { mode: 'bigint' }).notNull(),
});

export const matchResults = pgTable('match_results', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  finishPos: smallint('finish_pos'),
  bestLapMs: integer('best_lap_ms'),
  totalTimeMs: integer('total_time_ms'),
  xpAwarded: integer('xp_awarded').default(0).notNull(),
}, (table) => [
  primaryKey({ columns: [table.matchId, table.userId] }),
  index('idx_match_results_user').on(table.userId),
]);

// 5. Telemetry
export const perfSamples = pgTable('perf_samples', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  matchId: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }),
  fpsP50: smallint('fps_p50'),
  fpsP95: smallint('fps_p95'),
  rttMs: smallint('rtt_ms'),
  deviceUa: text('device_ua'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
});
