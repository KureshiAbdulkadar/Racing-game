import * as THREE from 'three';
import { CarState } from '../physics/car-physics';
import { TrackData, SURFACE_TYPES } from '../tracks/track-data';
import { ThemeColors } from '../../design-tokens/theme';

interface Car3DAssets {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  wheels: THREE.Mesh[];
  calipers: THREE.Mesh[];
  taillights: THREE.Mesh;
  headlightSpotL?: THREE.SpotLight;
  headlightSpotR?: THREE.SpotLight;
  flameLeftOuter: THREE.Mesh;
  flameLeftInner: THREE.Mesh;
  flameRightOuter: THREE.Mesh;
  flameRightInner: THREE.Mesh;
  exhaustLight?: THREE.PointLight;
  underglowMesh: THREE.Mesh;
  labelSprite?: THREE.Sprite;
}

interface Nitro3DAsset {
  group: THREE.Group;
  bottle: THREE.Mesh;
  ring: THREE.Mesh;
  ring2: THREE.Mesh;
  id: string;
}

interface PooledParticle {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  life: number;
  maxLife: number;
  mat: THREE.MeshBasicMaterial;
}

export class ThreeRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  // Track & Environment
  private roadGroup = new THREE.Group();
  private sceneryGroup = new THREE.Group();
  private nitroGroup = new THREE.Group();
  private finishGateGroup = new THREE.Group();
  private turbines: { group: THREE.Group; rotor: THREE.Group; speed: number }[] = [];
  private laserBeacons: THREE.Mesh[] = [];
  private currentTrackId = '';

  // 3D Cars map: id -> Car3DAssets
  private carsMap = new Map<string, Car3DAssets>();

  // 3D Nitro Pickups map
  private nitroPickupsMap = new Map<string, Nitro3DAsset>();

  // Pre-Allocated Particle Pool (Zero GC allocation during 120 FPS gameplay)
  private particlePool: PooledParticle[] = [];
  private particleGroup = new THREE.Group();
  private readonly MAX_PARTICLES = 160;

  // Optimized Pre-Allocated Skid Buffer
  private skidPositions = new Float32Array(600 * 3);
  private skidCount = 0;
  private skidGeo = new THREE.BufferGeometry();
  private skidLineMesh!: THREE.LineSegments;

  // Camera settings - Firmly locked static POV camera (no pulling back)
  private camMode: 'chase' | 'close' | 'hood' | 'far' = 'chase';
  private camPos = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private animClock = 0;
  private finishCamAngle = 0;

  // Scale factor: converts 2D physics pixels to 3D world meters
  public readonly WORLD_SCALE = 0.25;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(canvas.width, canvas.height, false);
    // Pin-sharp 120 FPS pixel ratio (capped at 1.5 to eliminate 4K retina fill-rate bottlenecks)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;

    // Real-Time PCF Soft Shadows optimized for 120 FPS
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    // Cinematic Atmospheric Sunset Fog
    this.scene.fog = new THREE.FogExp2(0x1a1224, 0.003);

    // 3D Perspective Camera - Locked at 60° FOV (No disorienting FOV jumps)
    this.camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.2, 2200);

    this.setupSunsetEnvironment();
    this.setupLighting();
    this.initParticlePool();
    this.initSkidBuffer();

    this.scene.add(this.roadGroup);
    this.scene.add(this.sceneryGroup);
    this.scene.add(this.nitroGroup);
    this.scene.add(this.finishGateGroup);
    this.scene.add(this.particleGroup);
  }

  public resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  public cycleCameraMode() {
    const modes: ('chase' | 'close' | 'hood' | 'far')[] = ['chase', 'close', 'hood', 'far'];
    const idx = modes.indexOf(this.camMode);
    this.camMode = modes[(idx + 1) % modes.length];
    return this.camMode;
  }

  // Pre-allocate particle pool to eliminate Garbage Collection pauses at 120 FPS
  private initParticlePool() {
    const sphereGeo = new THREE.SphereGeometry(0.2, 6, 6);
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.visible = false;
      this.particleGroup.add(mesh);
      this.particlePool.push({
        mesh,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        life: 0,
        maxLife: 0.3,
        mat,
      });
    }
  }

  // Pre-allocated static buffer for skid marks
  private initSkidBuffer() {
    this.skidGeo.setAttribute('position', new THREE.BufferAttribute(this.skidPositions, 3));
    const skidMat = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.45 });
    this.skidLineMesh = new THREE.LineSegments(this.skidGeo, skidMat);
    this.roadGroup.add(this.skidLineMesh);
  }

  // 1. High-Quality Sunset Sky & Environment Reflection Map (Blender / Unity IBL Quality)
  private setupSunsetEnvironment() {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = 1024;
    bgCanvas.height = 512;
    const bgCtx = bgCanvas.getContext('2d')!;

    const grad = bgCtx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, '#0F0B1E');
    grad.addColorStop(0.18, '#2B122E');
    grad.addColorStop(0.38, '#7E2426');
    grad.addColorStop(0.62, '#C83E18');
    grad.addColorStop(0.80, '#FF8A00');
    grad.addColorStop(0.92, '#FFC107');
    grad.addColorStop(1.0, '#FFF8E1');

    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, 1024, 512);

    const sunGrad = bgCtx.createRadialGradient(720, 340, 10, 720, 340, 180);
    sunGrad.addColorStop(0.0, 'rgba(255, 255, 245, 1.0)');
    sunGrad.addColorStop(0.2, 'rgba(255, 220, 90, 0.9)');
    sunGrad.addColorStop(0.5, 'rgba(255, 120, 30, 0.45)');
    sunGrad.addColorStop(1.0, 'rgba(255, 80, 0, 0)');
    bgCtx.fillStyle = sunGrad;
    bgCtx.beginPath();
    bgCtx.arc(720, 340, 180, 0, Math.PI * 2);
    bgCtx.fill();

    bgCtx.fillStyle = '#150A14';
    bgCtx.beginPath();
    bgCtx.moveTo(0, 512);
    bgCtx.lineTo(0, 375);
    bgCtx.bezierCurveTo(125, 340, 250, 370, 375, 335);
    bgCtx.bezierCurveTo(500, 305, 625, 355, 750, 325);
    bgCtx.bezierCurveTo(875, 315, 960, 350, 1024, 340);
    bgCtx.lineTo(1024, 512);
    bgCtx.closePath();
    bgCtx.fill();

    const bgTexture = new THREE.CanvasTexture(bgCanvas);
    bgTexture.mapping = THREE.EquirectangularReflectionMapping;
    this.scene.background = bgTexture;
    this.scene.environment = bgTexture;

    this.createWindTurbines();
  }

  private createWindTurbines() {
    const mastMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, roughness: 0.35 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.25 });

    const turbinePositions = [
      { x: 45, z: -160, scale: 0.95 },
      { x: 85, z: -185, scale: 1.15 },
      { x: 125, z: -170, scale: 0.9 },
      { x: -75, z: -190, scale: 1.1 },
      { x: 185, z: -210, scale: 1.25 },
    ];

    turbinePositions.forEach((pos) => {
      const turbineGroup = new THREE.Group();
      turbineGroup.position.set(pos.x, 0, pos.z);
      turbineGroup.scale.setScalar(pos.scale);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 32, 8), mastMat);
      mast.position.y = 16;
      turbineGroup.add(mast);

      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 8), mastMat);
      hub.position.y = 32;
      turbineGroup.add(hub);

      const rotor = new THREE.Group();
      rotor.position.set(0, 32, 0.6);

      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.4, 14, 0.08), bladeMat);
        blade.position.y = 7.0;
        const bladeRoot = new THREE.Group();
        bladeRoot.rotation.z = (b * Math.PI * 2) / 3;
        bladeRoot.add(blade);
        rotor.add(bladeRoot);
      }

      turbineGroup.add(rotor);
      this.scene.add(turbineGroup);
      this.turbines.push({ group: turbineGroup, rotor, speed: 0.02 + Math.random() * 0.012 });
    });
  }

  // 2. Optimized Sunset Directional Lighting & High-Performance Shadow Bounds
  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xFFA726, 0.9);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFE082, 1.9);
    sunLight.position.set(80, 120, -100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -110;
    sunLight.shadow.camera.right = 110;
    sunLight.shadow.camera.top = 110;
    sunLight.shadow.camera.bottom = -110;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x7986CB, 0.55);
    fillLight.position.set(-70, 40, 80);
    this.scene.add(fillLight);
  }

  // 3. Build 3D Track, Photorealistic Asphalt, Grandstands, and Billboards
  public build3DTrack(track: TrackData) {
    if (this.currentTrackId === track.id) return;
    this.currentTrackId = track.id;

    while (this.roadGroup.children.length > 0) {
      this.roadGroup.remove(this.roadGroup.children[0]);
    }
    while (this.sceneryGroup.children.length > 0) {
      this.sceneryGroup.remove(this.sceneryGroup.children[0]);
    }
    while (this.nitroGroup.children.length > 0) {
      this.nitroGroup.remove(this.nitroGroup.children[0]);
    }
    while (this.finishGateGroup.children.length > 0) {
      this.finishGateGroup.remove(this.finishGateGroup.children[0]);
    }
    this.nitroPickupsMap.clear();
    this.laserBeacons = [];
    this.skidCount = 0;

    // Re-attach skid line mesh
    this.roadGroup.add(this.skidLineMesh);

    const ws = this.WORLD_SCALE;

    // Terrain Ground Plane
    const groundGeo = new THREE.PlaneGeometry(track.cols * track.tileSize * ws * 2.8, track.rows * track.tileSize * ws * 2.8);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1E1719,
      roughness: 0.95,
      metalness: 0.05,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set((track.cols * track.tileSize * ws) / 2, -0.06, (track.rows * track.tileSize * ws) / 2);
    groundMesh.receiveShadow = true;
    this.roadGroup.add(groundMesh);

    // Glowing Neon Chevron Barrier Wall Texture
    const chevronCanvas = document.createElement('canvas');
    chevronCanvas.width = 256;
    chevronCanvas.height = 64;
    const cCtx = chevronCanvas.getContext('2d')!;
    cCtx.fillStyle = '#0E1116';
    cCtx.fillRect(0, 0, 256, 64);
    cCtx.fillStyle = '#00FFAA';
    cCtx.fillRect(0, 0, 256, 8);
    cCtx.fillStyle = '#00FF66';
    for (let x = 12; x < 256; x += 36) {
      cCtx.beginPath();
      cCtx.moveTo(x, 14);
      cCtx.lineTo(x + 18, 36);
      cCtx.lineTo(x, 58);
      cCtx.lineTo(x + 10, 58);
      cCtx.lineTo(x + 28, 36);
      cCtx.lineTo(x + 10, 14);
      cCtx.closePath();
      cCtx.fill();
    }
    const chevronTex = new THREE.CanvasTexture(chevronCanvas);
    chevronTex.wrapS = THREE.RepeatWrapping;
    chevronTex.wrapT = THREE.RepeatWrapping;
    chevronTex.repeat.set(2, 1);

    const barrierMat = new THREE.MeshStandardMaterial({
      map: chevronTex,
      emissive: 0x00FF66,
      emissiveIntensity: 0.8,
      roughness: 0.22,
      metalness: 0.65,
    });

    // Checkered Start / Finish Line Texture
    const checkCanvas = document.createElement('canvas');
    checkCanvas.width = 128;
    checkCanvas.height = 128;
    const chCtx = checkCanvas.getContext('2d')!;
    const sq = 16;
    for (let y = 0; y < 128; y += sq) {
      for (let x = 0; x < 128; x += sq) {
        const isWhite = (x / sq + y / sq) % 2 === 0;
        chCtx.fillStyle = isWhite ? '#FFFFFF' : '#141416';
        chCtx.fillRect(x, y, sq, sq);
      }
    }
    const checkTex = new THREE.CanvasTexture(checkCanvas);
    const finishMat = new THREE.MeshStandardMaterial({ map: checkTex, roughness: 0.35 });

    // High-Resolution Asphalt Texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 256;
    roadCanvas.height = 256;
    const rCtx = roadCanvas.getContext('2d')!;
    rCtx.fillStyle = '#20232A';
    rCtx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 1500; i++) {
      const nx = Math.random() * 256;
      const ny = Math.random() * 256;
      rCtx.fillStyle = Math.random() > 0.5 ? '#2B2F38' : '#15171D';
      rCtx.fillRect(nx, ny, 2, 2);
    }

    const roadTex = new THREE.CanvasTexture(roadCanvas);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(3, 3);

    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.72,
      metalness: 0.15,
    });

    const boostMat = new THREE.MeshStandardMaterial({
      color: 0x00E5FF,
      emissive: 0x00E5FF,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });

    // Build road tiles and barriers
    for (let r = 0; r < track.rows; r++) {
      for (let c = 0; c < track.cols; c++) {
        const type = track.tiles[r][c];
        const px = (c * track.tileSize + track.tileSize / 2) * ws;
        const pz = (r * track.tileSize + track.tileSize / 2) * ws;
        const size = track.tileSize * ws;

        if (
          type === SURFACE_TYPES.TRACK ||
          type === SURFACE_TYPES.OIL ||
          type === SURFACE_TYPES.BOOST ||
          type === SURFACE_TYPES.FINISH
        ) {
          const tileGeo = new THREE.PlaneGeometry(size, size);
          let mat = roadMat;
          if (type === SURFACE_TYPES.BOOST) mat = boostMat;
          if (type === SURFACE_TYPES.FINISH) mat = finishMat;

          const tile = new THREE.Mesh(tileGeo, mat);
          tile.rotation.x = -Math.PI / 2;
          tile.position.set(px, 0.01, pz);
          tile.receiveShadow = true;
          this.roadGroup.add(tile);
        } else if (type === SURFACE_TYPES.WALL) {
          const wallGeo = new THREE.BoxGeometry(size, 2.2, size);
          const wall = new THREE.Mesh(wallGeo, barrierMat);
          wall.position.set(px, 1.1, pz);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.roadGroup.add(wall);
        }
      }
    }

    this.buildRacingCurbs(track);
    this.buildLaneMarkings(track);
    this.buildStartingGridBoxes(track);
    this.buildGrandstandsAndBillboards(track);
    this.buildNitroPickups(track);
    this.buildFinishGate(track);
    this.buildRoadsideProps(track);
  }

  private buildRacingCurbs(track: TrackData) {
    const ws = this.WORLD_SCALE;
    const curbCanvas = document.createElement('canvas');
    curbCanvas.width = 64;
    curbCanvas.height = 32;
    const ctx = curbCanvas.getContext('2d')!;
    ctx.fillStyle = '#D50000';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(32, 0, 32, 32);

    const curbTex = new THREE.CanvasTexture(curbCanvas);
    curbTex.wrapS = THREE.RepeatWrapping;
    curbTex.wrapT = THREE.RepeatWrapping;
    curbTex.repeat.set(4, 1);

    const curbMat = new THREE.MeshStandardMaterial({
      map: curbTex,
      roughness: 0.45,
    });

    for (let i = 0; i < track.waypoints.length; i++) {
      const p1 = track.waypoints[i];
      const p2 = track.waypoints[(i + 1) % track.waypoints.length];

      const dx = (p2.x - p1.x) * ws;
      const dz = (p2.y - p1.y) * ws;
      const dist = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);

      const nx = -Math.sin(angle);
      const nz = Math.cos(angle);
      const roadHalfWidth = 3.6 * track.tileSize * ws * 0.45;

      const leftCurbGeo = new THREE.BoxGeometry(dist, 0.12, 0.7);
      const leftCurb = new THREE.Mesh(leftCurbGeo, curbMat);
      leftCurb.position.set((p1.x * ws + p2.x * ws) / 2 + nx * roadHalfWidth, 0.06, (p1.y * ws + p2.y * ws) / 2 + nz * roadHalfWidth);
      leftCurb.rotation.y = -angle;
      leftCurb.receiveShadow = true;
      this.roadGroup.add(leftCurb);

      const rightCurb = new THREE.Mesh(leftCurbGeo, curbMat);
      rightCurb.position.set((p1.x * ws + p2.x * ws) / 2 - nx * roadHalfWidth, 0.06, (p1.y * ws + p2.y * ws) / 2 - nz * roadHalfWidth);
      rightCurb.rotation.y = -angle;
      rightCurb.receiveShadow = true;
      this.roadGroup.add(rightCurb);
    }
  }

  private buildLaneMarkings(track: TrackData) {
    if (track.waypoints.length < 2) return;
    const ws = this.WORLD_SCALE;
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    for (let i = 0; i < track.waypoints.length; i++) {
      const p1 = track.waypoints[i];
      const p2 = track.waypoints[(i + 1) % track.waypoints.length];

      const dx = (p2.x - p1.x) * ws;
      const dz = (p2.y - p1.y) * ws;
      const dist = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);

      const dashLength = 3.6;
      const dashGap = 2.4;
      const step = dashLength + dashGap;
      const numDashes = Math.floor(dist / step);

      for (let d = 0; d < numDashes; d++) {
        const t = (d * step + dashLength / 2) / dist;
        const mx = p1.x * ws + dx * t;
        const mz = p1.y * ws + dz * t;

        const dashGeo = new THREE.PlaneGeometry(dashLength, 0.32);
        const dashMesh = new THREE.Mesh(dashGeo, dashMat);
        dashMesh.rotation.x = -Math.PI / 2;
        dashMesh.rotation.z = -angle;
        dashMesh.position.set(mx, 0.02, mz);
        this.roadGroup.add(dashMesh);
      }
    }
  }

  private buildStartingGridBoxes(track: TrackData) {
    const ws = this.WORLD_SCALE;
    const gridMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85 });
    const burnoutMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.65 });

    track.spawnSlots.slice(0, 5).forEach((slot) => {
      const boxGeo = new THREE.PlaneGeometry(3.2, 2.2);
      const boxMesh = new THREE.Mesh(boxGeo, gridMat);
      boxMesh.rotation.x = -Math.PI / 2;
      boxMesh.position.set(slot.x * ws, 0.025, slot.y * ws);
      this.roadGroup.add(boxMesh);

      const skidGeo = new THREE.PlaneGeometry(2.2, 0.35);
      const skidL = new THREE.Mesh(skidGeo, burnoutMat);
      skidL.rotation.x = -Math.PI / 2;
      skidL.position.set(slot.x * ws - 0.65, 0.028, slot.y * ws);
      this.roadGroup.add(skidL);

      const skidR = new THREE.Mesh(skidGeo, burnoutMat);
      skidR.rotation.x = -Math.PI / 2;
      skidR.position.set(slot.x * ws + 0.65, 0.028, slot.y * ws);
      this.roadGroup.add(skidR);
    });
  }

  private buildGrandstandsAndBillboards(track: TrackData) {
    const ws = this.WORLD_SCALE;
    const standMat = new THREE.MeshStandardMaterial({ color: 0x2C3038, roughness: 0.4, metalness: 0.6 });
    const seatMat1 = new THREE.MeshStandardMaterial({ color: 0xD50000, roughness: 0.5 });
    const seatMat2 = new THREE.MeshStandardMaterial({ color: 0x0091EA, roughness: 0.5 });

    const standGroup = new THREE.Group();
    standGroup.position.set(32 * 32 * ws, 0, 1.5 * 32 * ws);

    for (let tier = 0; tier < 5; tier++) {
      const stepGeo = new THREE.BoxGeometry(38, 0.8, 1.6);
      const step = new THREE.Mesh(stepGeo, standMat);
      step.position.set(0, tier * 0.8 + 0.4, -tier * 1.6);
      step.castShadow = true;
      step.receiveShadow = true;
      standGroup.add(step);

      const seatGeo = new THREE.BoxGeometry(37, 0.3, 0.9);
      const seat = new THREE.Mesh(seatGeo, tier % 2 === 0 ? seatMat1 : seatMat2);
      seat.position.set(0, tier * 0.8 + 0.9, -tier * 1.6 + 0.2);
      seat.castShadow = true;
      standGroup.add(seat);
    }
    this.sceneryGroup.add(standGroup);

    const billboardLabels = ['ASPHALT 4K', 'TURBO NITRO 2X', 'HYPER SPEED GP'];
    const billboardColors = ['#00E5FF', '#FF3D00', '#00FF66'];
    const bbPositions = [
      { x: 22 * 32 * ws, z: 1.5 * 32 * ws },
      { x: 44 * 32 * ws, z: 1.5 * 32 * ws },
      { x: 55 * 32 * ws, z: 1.5 * 32 * ws },
    ];

    bbPositions.forEach((pos, idx) => {
      const bbGroup = new THREE.Group();
      bbGroup.position.set(pos.x, 0, pos.z);

      const postMat = new THREE.MeshStandardMaterial({ color: 0x333338, metalness: 0.8 });
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8), postMat);
      postL.position.set(-3.5, 2.25, 0);
      bbGroup.add(postL);

      const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.5, 8), postMat);
      postR.position.set(3.5, 2.25, 0);
      bbGroup.add(postR);

      const bCanvas = document.createElement('canvas');
      bCanvas.width = 256;
      bCanvas.height = 64;
      const bCtx = bCanvas.getContext('2d')!;
      bCtx.fillStyle = '#0B0D14';
      bCtx.fillRect(0, 0, 256, 64);
      bCtx.strokeStyle = billboardColors[idx];
      bCtx.lineWidth = 4;
      bCtx.strokeRect(2, 2, 252, 60);

      bCtx.font = 'bold italic 24px "Arial Black", sans-serif';
      bCtx.textAlign = 'center';
      bCtx.textBaseline = 'middle';
      bCtx.fillStyle = billboardColors[idx];
      bCtx.fillText(billboardLabels[idx], 128, 32);

      const bTex = new THREE.CanvasTexture(bCanvas);
      const bMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.0), new THREE.MeshBasicMaterial({ map: bTex }));
      bMesh.position.set(0, 4.2, 0);
      bbGroup.add(bMesh);

      this.sceneryGroup.add(bbGroup);
    });
  }

  private buildNitroPickups(track: TrackData) {
    if (!track.nitroPickups) return;
    const ws = this.WORLD_SCALE;

    const bottleMat = new THREE.MeshStandardMaterial({
      color: 0x00E5FF,
      emissive: 0x00E5FF,
      emissiveIntensity: 1.4,
      metalness: 0.9,
      roughness: 0.08,
    });

    const capMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, metalness: 0.95, roughness: 0.08 });
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xFF3D00, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.75, side: THREE.DoubleSide });

    track.nitroPickups.forEach((pickup) => {
      const group = new THREE.Group();
      group.position.set(pickup.x * ws, 0.85, pickup.y * ws);

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 12), bottleMat);
      body.castShadow = true;
      group.add(body);

      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 8), capMat);
      cap.position.y = 0.65;
      group.add(cap);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 6, 16), ringMat);
      ring.rotation.x = Math.PI / 3;
      group.add(ring);

      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.045, 6, 16), ring2Mat);
      ring2.rotation.x = -Math.PI / 3;
      group.add(ring2);

      this.nitroGroup.add(group);
      this.nitroPickupsMap.set(pickup.id, { group, bottle: body, ring, ring2, id: pickup.id });
    });
  }

  private buildFinishGate(track: TrackData) {
    const ws = this.WORLD_SCALE;
    const gate = track.finishGate;
    if (!gate) return;

    const gateGroup = new THREE.Group();
    gateGroup.position.set(gate.x * ws, 0, gate.y * ws);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2A2A30, metalness: 0.85, roughness: 0.25 });
    const neonSignMat = new THREE.MeshStandardMaterial({ color: 0x00FF66, emissive: 0x00FF66, emissiveIntensity: 1.8 });

    const spanWidth = (gate.width || 7 * 32) * ws;
    const height = 6.2;

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.8), metalMat);
    leftPillar.position.set(0, height / 2, -spanWidth / 2);
    leftPillar.castShadow = true;
    gateGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, height, 0.8), metalMat);
    rightPillar.position.set(0, height / 2, spanWidth / 2);
    rightPillar.castShadow = true;
    gateGroup.add(rightPillar);

    const truss = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, spanWidth + 1.4), metalMat);
    truss.position.set(0, height, 0);
    truss.castShadow = true;
    gateGroup.add(truss);

    // SKY-HIGH LASER BEACONS
    const laserMatCyan = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    const laserMatGreen = new THREE.MeshBasicMaterial({ color: 0x00FF66, transparent: true, opacity: 0.8, side: THREE.DoubleSide });

    const laserGeo = new THREE.CylinderGeometry(0.45, 1.3, 400, 12);
    const laserLeft = new THREE.Mesh(laserGeo, laserMatCyan);
    laserLeft.position.set(0, 200, -spanWidth / 2);
    gateGroup.add(laserLeft);
    this.laserBeacons.push(laserLeft);

    const laserRight = new THREE.Mesh(laserGeo, laserMatGreen);
    laserRight.position.set(0, 200, spanWidth / 2);
    gateGroup.add(laserRight);
    this.laserBeacons.push(laserRight);

    // Glowing Neon "FINISH" Sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 64;
    const sCtx = signCanvas.getContext('2d')!;
    sCtx.fillStyle = '#0F1218';
    sCtx.fillRect(0, 0, 256, 64);
    sCtx.font = 'bold italic 34px "Arial Black", sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillStyle = '#00FF66';
    sCtx.fillText('🏁 FINISH 🏁', 128, 32);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signGeo = new THREE.PlaneGeometry(spanWidth * 0.75, 1.5);

    const signMeshFront = new THREE.Mesh(signGeo, signMat);
    signMeshFront.rotation.y = -Math.PI / 2;
    signMeshFront.position.set(-0.52, height, 0);
    gateGroup.add(signMeshFront);

    const signMeshBack = new THREE.Mesh(signGeo, signMat);
    signMeshBack.rotation.y = Math.PI / 2;
    signMeshBack.position.set(0.52, height, 0);
    gateGroup.add(signMeshBack);

    const spotLeft = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), neonSignMat);
    spotLeft.position.set(0, height + 0.8, -spanWidth / 3);
    gateGroup.add(spotLeft);

    const spotRight = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), neonSignMat);
    spotRight.position.set(0, height + 0.8, spanWidth / 3);
    gateGroup.add(spotRight);

    this.finishGateGroup.add(gateGroup);
  }

  private buildRoadsideProps(track: TrackData) {
    const ws = this.WORLD_SCALE;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333338, metalness: 0.7, roughness: 0.3 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xFFE082 });

    track.waypoints.forEach((wp, i) => {
      if (i % 2 === 0) {
        const lampGroup = new THREE.Group();
        lampGroup.position.set(wp.x * ws + 8, 0, wp.y * ws - 6);

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.5, 6), poleMat);
        pole.position.y = 3.75;
        pole.castShadow = true;
        lampGroup.add(pole);

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), poleMat);
        arm.rotation.z = Math.PI / 3;
        arm.position.set(-0.8, 7.2, 0);
        lampGroup.add(arm);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.32, 6, 6), lampMat);
        bulb.position.set(-1.6, 7.5, 0);
        lampGroup.add(bulb);

        this.sceneryGroup.add(lampGroup);
      }
    });
  }

  // 4. Create High-Fidelity 3D GT Sports Cars with Silencer Exhaust Fire & Underglow
  private getOrCreateCarMesh(car: CarState, isPlayer: boolean, rankIndex: number): Car3DAssets {
    let assets = this.carsMap.get(car.id);
    if (assets) return assets;

    const group = new THREE.Group();

    const primaryColor = new THREE.Color(isPlayer ? '#FF3D00' : car.customization.primaryColor);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      metalness: 0.90,
      roughness: 0.12,
    });

    const blackCarbonMat = new THREE.MeshStandardMaterial({
      color: 0x121216,
      roughness: 0.3,
      metalness: 0.75,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x080D14,
      roughness: 0.06,
      metalness: 0.95,
      transparent: true,
      opacity: 0.88,
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xFF0033,
      emissive: 0xFF0033,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    });

    const headlightGlassMat = new THREE.MeshBasicMaterial({ color: 0xE0F7FA });

    // Chassis & Aerodynamics
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.55, 4.0), bodyMat);
    bodyMesh.position.y = 0.42;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.35, 1.0), bodyMat);
    nose.position.set(0, 0.32, 2.2);
    nose.castShadow = true;
    group.add(nose);

    const hoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.6), blackCarbonMat);
    hoodVent.position.set(0, 0.70, 1.2);
    group.add(hoodVent);

    const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.06, 0.4), blackCarbonMat);
    splitter.position.set(0, 0.16, 2.6);
    splitter.castShadow = true;
    group.add(splitter);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.48, 1.9), glassMat);
    cabin.position.set(0, 0.84, -0.2);
    cabin.castShadow = true;
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.05, 1.7), bodyMat);
    roof.position.set(0, 1.08, -0.2);
    roof.castShadow = true;
    group.add(roof);

    const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.12), blackCarbonMat);
    mirrorL.position.set(-0.82, 0.78, 0.5);
    group.add(mirrorL);

    const mirrorR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.12), blackCarbonMat);
    mirrorR.position.set(0.82, 0.78, 0.5);
    group.add(mirrorR);

    // GT Wing
    const wingBlade = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.05, 0.38), blackCarbonMat);
    wingBlade.position.set(0, 1.04, -1.82);
    wingBlade.castShadow = true;
    group.add(wingBlade);

    const leftEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.42), blackCarbonMat);
    leftEndplate.position.set(-0.94, 1.04, -1.82);
    group.add(leftEndplate);

    const rightEndplate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.42), blackCarbonMat);
    rightEndplate.position.set(0.94, 1.04, -1.82);
    group.add(rightEndplate);

    const leftStrut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.08), blackCarbonMat);
    leftStrut.position.set(-0.46, 0.83, -1.78);
    group.add(leftStrut);

    const rightStrut = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.08), blackCarbonMat);
    rightStrut.position.set(0.46, 0.83, -1.78);
    group.add(rightStrut);

    // Diffuser & Exhausts
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.18, 0.3), blackCarbonMat);
    diffuser.position.set(0, 0.18, -1.96);
    group.add(diffuser);

    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.95, roughness: 0.08 });
    [-0.55, -0.42, 0.42, 0.55].forEach((exX) => {
      const exMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.25, 6), exhaustMat);
      exMesh.rotation.x = Math.PI / 2;
      exMesh.position.set(exX, 0.16, -2.06);
      group.add(exMesh);
    });

    // Headlights
    const hlLeftMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), headlightGlassMat);
    hlLeftMesh.position.set(-0.62, 0.42, 2.5);
    group.add(hlLeftMesh);

    const hlRightMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), headlightGlassMat);
    hlRightMesh.position.set(0.62, 0.42, 2.5);
    group.add(hlRightMesh);

    // Add dynamic SpotLight only on player car for peak 120 FPS performance
    let headlightSpotL: THREE.SpotLight | undefined;
    let headlightSpotR: THREE.SpotLight | undefined;
    if (isPlayer) {
      headlightSpotL = new THREE.SpotLight(0xE0F7FA, 2.2, 26, Math.PI / 5, 0.45, 1.2);
      headlightSpotL.position.set(-0.62, 0.45, 2.5);
      const targetL = new THREE.Object3D();
      targetL.position.set(-0.62, 0, 18);
      group.add(targetL);
      headlightSpotL.target = targetL;
      group.add(headlightSpotL);

      headlightSpotR = new THREE.SpotLight(0xE0F7FA, 2.2, 26, Math.PI / 5, 0.45, 1.2);
      headlightSpotR.position.set(0.62, 0.45, 2.5);
      const targetR = new THREE.Object3D();
      targetR.position.set(0.62, 0, 18);
      group.add(targetR);
      headlightSpotR.target = targetR;
      group.add(headlightSpotR);
    }

    // MULTI-LAYERED SILENCER EXHAUST FIRE
    const flameMatOuter = new THREE.MeshBasicMaterial({ color: 0x00E5FF, transparent: true, opacity: 0.95 });
    const flameMatInner = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.98 });

    const flameGeoOuter = new THREE.ConeGeometry(0.22, 1.5, 6);
    const flameLeftOuter = new THREE.Mesh(flameGeoOuter, flameMatOuter);
    flameLeftOuter.rotation.x = -Math.PI / 2;
    flameLeftOuter.position.set(-0.48, 0.16, -2.75);
    flameLeftOuter.visible = false;
    group.add(flameLeftOuter);

    const flameRightOuter = new THREE.Mesh(flameGeoOuter, flameMatOuter);
    flameRightOuter.rotation.x = -Math.PI / 2;
    flameRightOuter.position.set(0.48, 0.16, -2.75);
    flameRightOuter.visible = false;
    group.add(flameRightOuter);

    const flameGeoInner = new THREE.ConeGeometry(0.11, 0.9, 6);
    const flameLeftInner = new THREE.Mesh(flameGeoInner, flameMatInner);
    flameLeftInner.rotation.x = -Math.PI / 2;
    flameLeftInner.position.set(-0.48, 0.16, -2.55);
    flameLeftInner.visible = false;
    group.add(flameLeftInner);

    const flameRightInner = new THREE.Mesh(flameGeoInner, flameMatInner);
    flameRightInner.rotation.x = -Math.PI / 2;
    flameRightInner.position.set(0.48, 0.16, -2.55);
    flameRightInner.visible = false;
    group.add(flameRightInner);

    let exhaustLight: THREE.PointLight | undefined;
    if (isPlayer) {
      exhaustLight = new THREE.PointLight(0x00E5FF, 0, 6);
      exhaustLight.position.set(0, 0.25, -2.5);
      group.add(exhaustLight);
    }

    // Ground Underglow
    const underglowGeo = new THREE.PlaneGeometry(1.9, 3.4);
    const underglowMat = new THREE.MeshBasicMaterial({ color: primaryColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
    underglowMesh.rotation.x = -Math.PI / 2;
    underglowMesh.position.set(0, 0.03, 0);
    group.add(underglowMesh);

    // Taillights
    const taillights = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 0.05), taillightMat);
    taillights.position.set(0, 0.52, -2.02);
    group.add(taillights);

    // 4 Wide Tires with Alloy Rims & Calipers
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.8 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xDDDDDD, metalness: 0.92, roughness: 0.15 });
    const caliperMat = new THREE.MeshStandardMaterial({ color: 0xD50000, metalness: 0.8, roughness: 0.2 });
    const discMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.95, roughness: 0.1 });

    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.27, 6);
    const discGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 6);
    const caliperGeo = new THREE.BoxGeometry(0.12, 0.15, 0.08);

    const calipers: THREE.Mesh[] = [];
    const createWheel = (x: number, y: number, z: number) => {
      const wGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wGroup.add(tire);

      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wGroup.add(rim);

      const disc = new THREE.Mesh(discGeo, discMat);
      disc.rotation.z = Math.PI / 2;
      disc.position.x = x > 0 ? -0.06 : 0.06;
      wGroup.add(disc);

      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(x > 0 ? -0.06 : 0.06, 0.12, 0);
      wGroup.add(caliper);
      calipers.push(caliper);

      wGroup.position.set(x, y, z);
      group.add(wGroup);
      return tire;
    };

    const rl = createWheel(-0.95, 0.36, -1.3);
    const rr = createWheel(0.95, 0.36, -1.3);
    const fl = createWheel(-0.95, 0.36, 1.3);
    const fr = createWheel(0.95, 0.36, 1.3);

    // Rival Position Sprite
    let labelSprite: THREE.Sprite | undefined;
    if (!isPlayer) {
      const numCanvas = document.createElement('canvas');
      numCanvas.width = 64;
      numCanvas.height = 64;
      const nCtx = numCanvas.getContext('2d')!;

      nCtx.font = 'bold italic 44px "Arial Black", sans-serif';
      nCtx.textAlign = 'center';
      nCtx.textBaseline = 'middle';

      const orderLabels = ['1', '3', '2', '4', '5'];
      const orderColors = ['#00FF66', '#FF1744', '#FFD600', '#FFFFFF', '#00E5FF'];
      const rankNum = orderLabels[rankIndex % orderLabels.length];
      const numColor = orderColors[rankIndex % orderColors.length];

      nCtx.fillStyle = '#000000';
      nCtx.fillText(rankNum, 34, 34);
      nCtx.fillStyle = numColor;
      nCtx.fillText(rankNum, 32, 32);

      const numTex = new THREE.CanvasTexture(numCanvas);
      const spriteMat = new THREE.SpriteMaterial({ map: numTex, depthTest: false });
      labelSprite = new THREE.Sprite(spriteMat);
      labelSprite.scale.set(1.5, 1.5, 1.5);
      labelSprite.position.set(0, 2.3, 0);
      group.add(labelSprite);
    }

    this.scene.add(group);

    assets = {
      group,
      bodyMesh,
      wheels: [rl, rr, fl, fr],
      calipers,
      taillights,
      headlightSpotL,
      headlightSpotR,
      flameLeftOuter,
      flameLeftInner,
      flameRightOuter,
      flameRightInner,
      exhaustLight,
      underglowMesh,
      labelSprite,
    };
    this.carsMap.set(car.id, assets);
    return assets;
  }

  // 5. Zero-Allocation High-Performance Particle Emitter
  private spawnParticle(x: number, y: number, z: number, vx: number, vy: number, vz: number, maxLife: number, colorHex: number, rotSpeed = 0) {
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) {
        p.active = true;
        p.life = 0;
        p.maxLife = maxLife;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;
        p.rotX = rotSpeed;
        p.rotY = rotSpeed;
        p.rotZ = rotSpeed;
        p.mat.color.setHex(colorHex);
        p.mat.opacity = 0.9;
        p.mesh.position.set(x, y, z);
        p.mesh.scale.setScalar(1);
        p.mesh.visible = true;
        break;
      }
    }
  }

  public emitConfettiBurst(x: number, y: number) {
    const ws = this.WORLD_SCALE;
    const confettiColors = [0x00FF66, 0x00E5FF, 0xFF3D00, 0xFFD600, 0xFF007F, 0xFFFFFF];

    for (let i = 0; i < 60; i++) {
      const color = confettiColors[i % confettiColors.length];
      const spAngle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 5.0;
      this.spawnParticle(
        x * ws + (Math.random() - 0.5) * 5,
        5.5 + Math.random() * 2,
        y * ws + (Math.random() - 0.5) * 5,
        Math.cos(spAngle) * speed,
        2.0 + Math.random() * 4.0,
        Math.sin(spAngle) * speed,
        2.5,
        color,
        (Math.random() - 0.5) * 8
      );
    }
  }

  public emitDriftParticles(x: number, y: number, angle: number) {
    const ws = this.WORLD_SCALE;
    for (let i = 0; i < 2; i++) {
      const vx = -Math.cos(angle) * (1.2 + Math.random()) + (Math.random() - 0.5) * 0.8;
      const vz = -Math.sin(angle) * (1.2 + Math.random()) + (Math.random() - 0.5) * 0.8;
      this.spawnParticle(
        x * ws + (Math.random() - 0.5) * 0.4,
        0.2,
        y * ws + (Math.random() - 0.5) * 0.4,
        vx,
        0.5 + Math.random() * 0.5,
        vz,
        0.35,
        0xDDDDDD
      );
    }
  }

  public emitOffroadDust(x: number, y: number, angle: number) {
    const ws = this.WORLD_SCALE;
    const vx = -Math.cos(angle) * (1.8 + Math.random());
    const vz = -Math.sin(angle) * (1.8 + Math.random());
    this.spawnParticle(
      x * ws + (Math.random() - 0.5) * 0.5,
      0.25,
      y * ws + (Math.random() - 0.5) * 0.5,
      vx,
      0.8 + Math.random() * 0.6,
      vz,
      0.45,
      0x8D6E63
    );
  }

  public emitBoostParticles(x: number, y: number, angle: number, color = '#00E5FF') {
    const ws = this.WORLD_SCALE;
    const colorHex = color.startsWith('#') ? parseInt(color.slice(1), 16) : 0x00E5FF;
    for (let i = 0; i < 2; i++) {
      const vx = -Math.cos(angle) * (6.0 + Math.random() * 2.5);
      const vz = -Math.sin(angle) * (6.0 + Math.random() * 2.5);
      this.spawnParticle(x * ws, 0.25, y * ws, vx, 0.35, vz, 0.28, colorHex);
    }
  }

  public emitSparks(x: number, y: number) {
    const ws = this.WORLD_SCALE;
    for (let i = 0; i < 6; i++) {
      const spAngle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 3.5;
      this.spawnParticle(
        x * ws,
        0.45,
        y * ws,
        Math.cos(spAngle) * speed,
        1.8 + Math.random() * 1.5,
        Math.sin(spAngle) * speed,
        0.25,
        0xFFAA00
      );
    }
  }

  public addSkid(x1: number, y1: number, x2: number, y2: number) {
    const ws = this.WORLD_SCALE;
    if (this.skidCount >= 100) {
      // Shift buffer to prevent memory growth
      this.skidPositions.copyWithin(0, 6);
      this.skidCount--;
    }

    const idx = this.skidCount * 6;
    this.skidPositions[idx] = x1 * ws;
    this.skidPositions[idx + 1] = 0.015;
    this.skidPositions[idx + 2] = y1 * ws;
    this.skidPositions[idx + 3] = x2 * ws;
    this.skidPositions[idx + 4] = 0.015;
    this.skidPositions[idx + 5] = y2 * ws;
    this.skidCount++;

    this.skidGeo.attributes.position.needsUpdate = true;
    this.skidGeo.setDrawRange(0, this.skidCount * 2);
  }

  private updateParticles(dt: number) {
    for (let i = 0; i < this.particlePool.length; i++) {
      const p = this.particlePool[i];
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.rotX !== 0) {
        p.mesh.rotation.x += p.rotX * dt;
        p.mesh.rotation.y += p.rotY * dt;
        p.mesh.rotation.z += p.rotZ * dt;
        p.vy -= 3.5 * dt; // Gravity
      }

      const progress = p.life / p.maxLife;
      p.mat.opacity = Math.max(0, 0.9 * (1 - progress));
    }
  }

  // 6. Main 3D Render Loop: Locked Static POV Camera & Butter-Smooth 120 FPS
  public render(
    track: TrackData,
    cars: CarState[],
    playerCarId: string,
    alpha: number,
    theme: ThemeColors,
    countdown: number | null,
    raceStatus: 'countdown' | 'racing' | 'finished'
  ) {
    this.build3DTrack(track);
    this.animClock += 1 / 120;
    this.updateParticles(1 / 120);

    const ws = this.WORLD_SCALE;
    const playerCar = cars.find((c) => c.id === playerCarId) || cars[0];

    // Animate background wind turbines
    this.turbines.forEach((t) => {
      t.rotor.rotation.z += t.speed;
    });

    // Animate Sky Laser Beacons
    this.laserBeacons.forEach((beacon, i) => {
      const pulse = 0.75 + Math.sin(this.animClock * 4 + i) * 0.2;
      (beacon.material as THREE.MeshBasicMaterial).opacity = pulse;
    });

    // Animate 3D Nitro Gas Pickups
    if (track.nitroPickups) {
      track.nitroPickups.forEach((pickup, index) => {
        const asset = this.nitroPickupsMap.get(pickup.id);
        if (asset) {
          asset.group.visible = pickup.active;
          if (pickup.active) {
            asset.bottle.rotation.y += 0.045;
            asset.ring.rotation.z += 0.065;
            asset.ring2.rotation.y += 0.055;
            asset.group.position.y = 0.85 + Math.sin(this.animClock * 3.5 + index) * 0.18;
          }
        }
      });
    }

    // Update 3D position and rotation for each car
    cars.forEach((car, index) => {
      const assets = this.getOrCreateCarMesh(car, car.id === playerCarId, index);

      const ix = car.prevX + (car.x - car.prevX) * alpha;
      const iz = car.prevY + (car.y - car.prevY) * alpha;

      let dAngle = car.angle - car.prevAngle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      const iAngle = car.prevAngle + dAngle * alpha;

      assets.group.position.set(ix * ws, 0, iz * ws);
      assets.group.rotation.y = -iAngle + Math.PI / 2;

      const roll = (car.lateralVel / (car.stats.topSpeed || 150)) * 0.12;
      assets.group.rotation.z = roll;

      const spinSpeed = car.velocity * ws * 0.14;
      assets.wheels.forEach((w) => {
        w.rotation.x += spinSpeed;
      });

      // MULTI-LAYERED SILENCER EXHAUST FIRE
      if (car.boostActive) {
        assets.flameLeftOuter.visible = true;
        assets.flameLeftInner.visible = true;
        assets.flameRightOuter.visible = true;
        assets.flameRightInner.visible = true;
        if (assets.exhaustLight) assets.exhaustLight.intensity = 3.5;

        const flicker = 1.0 + Math.random() * 0.5;
        assets.flameLeftOuter.scale.set(flicker, flicker * 1.3, flicker);
        assets.flameRightOuter.scale.set(flicker, flicker * 1.3, flicker);
        assets.flameLeftInner.scale.set(flicker, flicker * 1.1, flicker);
        assets.flameRightInner.scale.set(flicker, flicker * 1.1, flicker);
      } else {
        assets.flameLeftOuter.visible = false;
        assets.flameLeftInner.visible = false;
        assets.flameRightOuter.visible = false;
        assets.flameRightInner.visible = false;
        if (assets.exhaustLight) assets.exhaustLight.intensity = 0;
      }

      if (car.isOffRoad && Math.abs(car.velocity) > 30) {
        this.emitOffroadDust(car.x, car.y, car.angle);
      }
    });

    // 7. FIRMLY LOCKED STATIC POV CAMERA
    if (playerCar) {
      const ix = (playerCar.prevX + (playerCar.x - playerCar.prevX) * alpha) * ws;
      const iz = (playerCar.prevY + (playerCar.y - playerCar.prevY) * alpha) * ws;

      let dAngle = playerCar.angle - playerCar.prevAngle;
      while (dAngle > Math.PI) dAngle -= Math.PI * 2;
      while (dAngle < -Math.PI) dAngle += Math.PI * 2;
      const iAngle = playerCar.prevAngle + dAngle * alpha;

      const fwdX = Math.cos(iAngle);
      const fwdZ = Math.sin(iAngle);

      this.camera.fov = 60;
      this.camera.updateProjectionMatrix();

      if (raceStatus === 'finished') {
        this.finishCamAngle += 0.015;
        const camOrbitDist = 6.5;
        const camOrbitHeight = 2.2;
        const finishCamX = ix + Math.cos(this.finishCamAngle) * camOrbitDist;
        const finishCamZ = iz + Math.sin(this.finishCamAngle) * camOrbitDist;
        this.camPos.lerp(new THREE.Vector3(finishCamX, camOrbitHeight, finishCamZ), 0.08);
        this.camTarget.lerp(new THREE.Vector3(ix, 0.8, iz), 0.12);
      } else {
        let camDistance = 3.9;
        let camHeight = 1.55;
        let lookDist = 18.0;
        let lookHeight = 1.1;

        if (this.camMode === 'close') {
          camDistance = 3.2;
          camHeight = 1.35;
          lookDist = 16.0;
          lookHeight = 0.95;
        } else if (this.camMode === 'hood') {
          camDistance = 0.2;
          camHeight = 0.95;
          lookDist = 22.0;
          lookHeight = 0.9;
        } else if (this.camMode === 'far') {
          camDistance = 5.2;
          camHeight = 2.2;
          lookDist = 20.0;
          lookHeight = 1.3;
        }

        const targetCamX = ix - fwdX * camDistance;
        const targetCamZ = iz - fwdZ * camDistance;
        const targetCamY = camHeight;

        const lookTargetX = ix + fwdX * lookDist;
        const lookTargetZ = iz + fwdZ * lookDist;
        const lookTargetY = lookHeight;

        if (this.camPos.lengthSq() === 0) {
          this.camPos.set(targetCamX, targetCamY, targetCamZ);
          this.camTarget.set(lookTargetX, lookTargetY, lookTargetZ);
        } else {
          // Direct tight lerp ensures zero elastic drift when hitting gas or nitro!
          this.camPos.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.35);
          this.camTarget.lerp(new THREE.Vector3(lookTargetX, lookTargetY, lookTargetZ), 0.40);
        }
      }

      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camTarget);
    }

    // Render WebGL Scene
    this.renderer.render(this.scene, this.camera);
  }
}
