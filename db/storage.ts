import { CarCustomization, DEFAULT_CAR_CUSTOMIZATION } from '../game/physics/car-physics';
import { ThemeName } from '../design-tokens/theme';

export interface UserProfile {
  id: string;
  displayName: string;
  isGuest: boolean;
  xp: number;
  level: number;
  preferredTheme: ThemeName;
  stats: {
    racesCompleted: number;
    firstPlaces: number;
    secondPlaces: number;
    thirdPlaces: number;
    bestLaps: Record<string, number>; // trackId -> ms
    driftsPerformed: number;
  };
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  theme: ThemeName;
  crtScanlines: boolean;
  qualityPreset: 'performance' | 'high';
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  theme: 'neon-night',
  crtScanlines: true,
  qualityPreset: 'high',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'guest-' + Math.random().toString(36).substring(2, 9),
  displayName: 'PixelRacer',
  isGuest: true,
  xp: 150,
  level: 1,
  preferredTheme: 'neon-night',
  stats: {
    racesCompleted: 0,
    firstPlaces: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    bestLaps: {},
    driftsPerformed: 0,
  },
};

const PROFILE_KEY = 'pixel_racer_user_profile';
const CAR_KEY = 'pixel_racer_custom_car';
const SETTINGS_KEY = 'pixel_racer_settings';

export function getUserProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_USER_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_USER_PROFILE;
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {}
}

export function getPlayerCarCustomization(): CarCustomization {
  if (typeof window === 'undefined') return DEFAULT_CAR_CUSTOMIZATION;
  try {
    const raw = localStorage.getItem(CAR_KEY);
    if (raw) return { ...DEFAULT_CAR_CUSTOMIZATION, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_CAR_CUSTOMIZATION;
}

export function savePlayerCarCustomization(customization: CarCustomization): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CAR_KEY, JSON.stringify(customization));
  } catch (e) {}
}

export function getGameSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

export function saveGameSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

export function recordRaceFinish(trackId: string, position: number, totalTimeSec: number, bestLapSec: number | null): UserProfile {
  const profile = getUserProfile();
  profile.stats.racesCompleted += 1;

  if (position === 1) profile.stats.firstPlaces += 1;
  else if (position === 2) profile.stats.secondPlaces += 1;
  else if (position === 3) profile.stats.thirdPlaces += 1;

  // XP calculation: 100 for finish, +150 for 1st, +80 for 2nd, +40 for 3rd
  const xpEarned = 100 + (position === 1 ? 150 : position === 2 ? 80 : position === 3 ? 40 : 10);
  profile.xp += xpEarned;
  profile.level = Math.floor(profile.xp / 300) + 1;

  if (bestLapSec !== null) {
    const bestMs = Math.round(bestLapSec * 1000);
    const existing = profile.stats.bestLaps[trackId];
    if (!existing || bestMs < existing) {
      profile.stats.bestLaps[trackId] = bestMs;
    }
  }

  saveUserProfile(profile);
  return profile;
}
