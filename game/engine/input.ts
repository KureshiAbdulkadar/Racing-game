import { CarInputState } from '../physics/car-physics';

export class InputManager {
  private keyState: Record<string, boolean> = {};
  private touchState: CarInputState = {
    throttle: 0,
    brake: 0,
    steer: 0,
    drift: false,
    boost: false,
    horn: false,
  };
  private onPauseCallback?: () => void;
  private onHornCallback?: () => void;
  private onCameraToggleCallback?: () => void;
  private isDestroyed = false;

  constructor(onPause?: () => void, onHorn?: () => void, onCameraToggle?: () => void) {
    this.onPauseCallback = onPause;
    this.onHornCallback = onHorn;
    this.onCameraToggleCallback = onCameraToggle;
    this.setupListeners();
  }

  private setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    this.keyState[e.code] = true;

    if (e.code === 'KeyP' || e.code === 'Escape') {
      this.onPauseCallback?.();
    }
    if (e.code === 'KeyH' && !e.repeat) {
      this.onHornCallback?.();
    }
    if (e.code === 'KeyC' && !e.repeat) {
      this.onCameraToggleCallback?.();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keyState[e.code] = false;
  };

  // Called by touch overlay components on mobile
  public setTouchInput(partial: Partial<CarInputState>) {
    this.touchState = { ...this.touchState, ...partial };
  }

  public getInput(): CarInputState {
    let throttle = 0;
    let brake = 0;
    let steer = 0;
    let drift = false;
    let boost = false;
    let horn = false;

    // 1. Keyboard checks
    if (this.keyState['KeyW'] || this.keyState['ArrowUp']) {
      throttle = 1;
    }
    if (this.keyState['KeyS'] || this.keyState['ArrowDown']) {
      brake = 1;
    }
    if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) {
      steer -= 1;
    }
    if (this.keyState['KeyD'] || this.keyState['ArrowRight']) {
      steer += 1;
    }
    if (this.keyState['Space']) {
      drift = true;
    }
    if (this.keyState['ShiftLeft'] || this.keyState['ShiftRight']) {
      boost = true;
    }
    if (this.keyState['KeyH']) {
      horn = true;
    }

    // 2. Gamepad checks
    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      const pad = gamepads[0];
      if (pad && pad.connected) {
        // Left stick X
        const stickX = pad.axes[0];
        if (Math.abs(stickX) > 0.15) {
          steer = stickX;
        }

        // D-Pad
        if (pad.buttons[14]?.pressed) steer = -1;
        if (pad.buttons[15]?.pressed) steer = 1;

        // Triggers / Face buttons
        const rTrigger = pad.buttons[7]?.value || (pad.buttons[0]?.pressed ? 1 : 0); // RT or A
        const lTrigger = pad.buttons[6]?.value || (pad.buttons[1]?.pressed ? 1 : 0); // LT or B
        if (rTrigger > 0.1) throttle = Math.max(throttle, rTrigger);
        if (lTrigger > 0.1) brake = Math.max(brake, lTrigger);

        if (pad.buttons[2]?.pressed || pad.buttons[5]?.pressed) boost = true; // X or RB
        if (pad.buttons[4]?.pressed) drift = true; // LB
        if (pad.buttons[3]?.pressed) horn = true;  // Y
      }
    }

    // 3. Touch input blend
    if (this.touchState.throttle > 0) throttle = Math.max(throttle, this.touchState.throttle);
    if (this.touchState.brake > 0) brake = Math.max(brake, this.touchState.brake);
    if (Math.abs(this.touchState.steer) > 0) steer = this.touchState.steer;
    if (this.touchState.drift) drift = true;
    if (this.touchState.boost) boost = true;
    if (this.touchState.horn) horn = true;

    return {
      throttle,
      brake,
      steer: Math.max(-1, Math.min(1, steer)),
      drift,
      boost,
      horn,
    };
  }

  public destroy() {
    this.isDestroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);
    }
  }
}
