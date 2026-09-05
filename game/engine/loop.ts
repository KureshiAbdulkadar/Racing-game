export interface TelemetryStats {
  fps: number;
  frameTimeP50: number;
  frameTimeP95: number;
  droppedFrames: number;
}

export class GameLoop {
  private isRunning = false;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private accumulator = 0;
  private readonly fixedStep = 1 / 60; // 60 Hz simulation tick (16.66ms)

  // Performance telemetry
  private frameTimes: number[] = [];
  private fpsSampleCounter = 0;
  private lastFpsUpdate = 0;
  private currentFps = 60;
  private p50 = 11.1;
  private p95 = 11.1;
  private droppedFrames = 0;

  constructor(
    private updateFn: (dt: number) => void,
    private renderFn: (alpha: number) => void,
    private onTelemetry?: (stats: TelemetryStats) => void
  ) {}

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.accumulator = 0;
    this.frameTimes = [];
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop = (currentTime: number) => {
    if (!this.isRunning) return;

    const frameStart = performance.now();
    let frameDelta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Prevent spiral of death on tab unfocus/heavy hitch
    if (frameDelta > 0.15) {
      frameDelta = 0.15;
      this.droppedFrames++;
    }

    this.accumulator += frameDelta;

    // Run physics simulation ticks at fixed 60 Hz
    let ticks = 0;
    while (this.accumulator >= this.fixedStep && ticks < 5) {
      this.updateFn(this.fixedStep);
      this.accumulator -= this.fixedStep;
      ticks++;
    }

    // Alpha interpolation fraction for butter-smooth 90+ FPS rendering
    const alpha = Math.min(1, Math.max(0, this.accumulator / this.fixedStep));
    this.renderFn(alpha);

    // Measure frame time
    const frameElapsed = performance.now() - frameStart;
    this.frameTimes.push(frameElapsed);
    if (this.frameTimes.length > 120) {
      this.frameTimes.shift();
    }

    // Compute FPS & p95 every 500ms
    this.fpsSampleCounter++;
    if (currentTime - this.lastFpsUpdate >= 500) {
      this.currentFps = Math.round((this.fpsSampleCounter * 1000) / (currentTime - this.lastFpsUpdate));
      this.fpsSampleCounter = 0;
      this.lastFpsUpdate = currentTime;

      if (this.frameTimes.length > 0) {
        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        this.p50 = Number(sorted[Math.floor(sorted.length * 0.5)].toFixed(2));
        this.p95 = Number(sorted[Math.floor(sorted.length * 0.95)].toFixed(2));
      }

      this.onTelemetry?.({
        fps: this.currentFps,
        frameTimeP50: this.p50,
        frameTimeP95: this.p95,
        droppedFrames: this.droppedFrames,
      });
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
