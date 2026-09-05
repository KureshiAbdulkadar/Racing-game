'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { getGameSettings, saveGameSettings, GameSettings } from '@/db/storage';
import { THEMES, ThemeName, applyTheme } from '@/design-tokens/theme';
import { getSoundEngine } from '@/game/engine/audio';

export default function SettingsPage() {
  const [settings, setSettings] = useState<GameSettings>(getGameSettings());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = getGameSettings();
    setSettings(s);
  }, []);

  const handleThemeChange = (themeName: ThemeName) => {
    const updated = { ...settings, theme: themeName };
    setSettings(updated);
    saveGameSettings(updated);
    applyTheme(themeName);
  };

  const handleVolumeChange = (type: 'masterVolume' | 'sfxVolume' | 'musicVolume', val: number) => {
    const updated = { ...settings, [type]: val };
    setSettings(updated);
    saveGameSettings(updated);

    const sound = getSoundEngine();
    sound.unlock();
    if (type === 'masterVolume') sound.setMasterVolume(val);
    if (type === 'sfxVolume') {
      sound.setSFXVolume(val);
      sound.playBoost();
    }
    if (type === 'musicVolume') sound.setMusicVolume(val);
  };

  const toggleScanlines = () => {
    const next = !settings.crtScanlines;
    const updated = { ...settings, crtScanlines: next };
    setSettings(updated);
    saveGameSettings(updated);

    // Toggle CRT classes on DOM
    const crt = document.querySelector('.crt-overlay') as HTMLElement;
    if (crt) crt.style.display = next ? 'block' : 'none';
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{
        flex: 1,
        padding: '32px 20px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
      }}>
        <h1 className="pixel-title" style={{ fontSize: '24px', color: '#FFF', marginBottom: '8px' }}>
          GAME SETTINGS
        </h1>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#A0A0B0', marginBottom: '28px' }}>
          AUDIO • RETRO THEMES • CRT SHADER • CONTROLS
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Audio Controls */}
          <div className="arcade-card">
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: 'var(--accent)', marginBottom: '16px' }}>
              AUDIO & SYNTHESIZER
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '10px', marginBottom: '6px' }}>
                  <span>MASTER VOLUME</span>
                  <span>{Math.round(settings.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.masterVolume}
                  onChange={(e) => handleVolumeChange('masterVolume', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '10px', marginBottom: '6px' }}>
                  <span>SFX & ENGINE VOLUME</span>
                  <span>{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  onChange={(e) => handleVolumeChange('sfxVolume', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent-2)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-pixel)', fontSize: '10px', marginBottom: '6px' }}>
                  <span>CHIPTUNE MUSIC VOLUME</span>
                  <span>{Math.round(settings.musicVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.musicVolume}
                  onChange={(e) => handleVolumeChange('musicVolume', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#FFEA00' }}
                />
              </div>
            </div>
          </div>

          {/* Theme Switcher */}
          <div className="arcade-card">
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: 'var(--accent-2)', marginBottom: '16px' }}>
              COLOR THEMES (SECTION 3 TOKENS)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {(Object.keys(THEMES) as ThemeName[]).map((themeKey) => {
                const isCurrent = settings.theme === themeKey;
                const thm = THEMES[themeKey];
                return (
                  <button
                    key={themeKey}
                    onClick={() => handleThemeChange(themeKey)}
                    className={`btn-arcade ${isCurrent ? '' : 'btn-arcade-ghost'}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: '14px',
                      gap: '8px',
                      fontSize: '10px',
                    }}
                  >
                    <span>{thm.name}</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div style={{ width: '12px', height: '12px', background: thm.colors.accent, borderRadius: '2px' }} />
                      <div style={{ width: '12px', height: '12px', background: thm.colors.accent2, borderRadius: '2px' }} />
                      <div style={{ width: '12px', height: '12px', background: thm.colors.track, borderRadius: '2px' }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Visual Display Options */}
          <div className="arcade-card">
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: '#FFEA00', marginBottom: '16px' }}>
              DISPLAY & SHADERS
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '11px', color: '#FFF' }}>
                  CRT SCANLINE OVERLAY
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Simulates arcade phosphor cathode-ray scanlines
                </div>
              </div>

              <button
                onClick={toggleScanlines}
                className={`btn-arcade ${settings.crtScanlines ? 'btn-arcade-secondary' : 'btn-arcade-ghost'}`}
                style={{ padding: '8px 16px', fontSize: '10px' }}
              >
                {settings.crtScanlines ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>
          </div>

          {/* Keyboard & Gamepad Cheat Sheet */}
          <div className="arcade-card">
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: '12px', color: '#00FF44', marginBottom: '16px' }}>
              CONTROLS MAPPING (XINPUT & KEYBOARD)
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
            }}>
              <div style={{ background: 'var(--bg-1)', padding: '12px', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--accent)' }}>THROTTLE:</strong> W / Up Arrow / RT / A
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '12px', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--accent)' }}>BRAKE / REVERSE:</strong> S / Down / LT / B
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '12px', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--accent)' }}>STEERING:</strong> A/D / Left/Right / Stick
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '12px', border: '1px solid var(--border)' }}>
                <strong style={{ color: 'var(--accent-2)' }}>DRIFT:</strong> Space / LB
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '12px', border: '1px solid var(--border)' }}>
                <strong style={{ color: '#FFEA00' }}>BOOST:</strong> Shift / X / RB
              </div>
              <div style={{ background: 'var(--bg-1)', padding: '12px', border: '1px solid var(--border)' }}>
                <strong style={{ color: '#FFF' }}>HORN:</strong> H / Y Button
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
