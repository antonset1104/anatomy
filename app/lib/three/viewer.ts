import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import type { Hotspot } from "../../i18n/merge";
import { AnatomyAssetManager, FIT_SIZE, type LoadedOrgan } from "./loaders";
import { HotspotLayer } from "./hotspots";
import type { ViewName } from "../url-state";

type ViewerCallbacks = {
  onLoading: (loading: boolean, progress: number) => void;
  onSelect: (hotspot: Hotspot | null) => void;
  /** Quiz mode: every dot press is reported, with no selection toggling. */
  onPick?: (hotspot: Hotspot) => void;
  /** Authoring mode: a point on the mesh surface, in pivot space. */
  onAuthorPoint?: (point: { x: number; y: number; z: number }) => void;
  /** Measure mode: distance between the two sampled points, in model units. */
  onMeasure?: (distance: number | null) => void;
  onError?: (error: unknown) => void;
};

export type Quality = "auto" | "high" | "low";
export type SectionAxis = "x" | "y" | "z";
export type ViewerTheme = "light" | "dark";

const DOT_PIXELS = 34;
const CAMERA_FOV = 34;
const DEPTH_PREPASS = "depth-prepass";
const PLINTH_Y = -2.5;
const PLINTH_TOP = PLINTH_Y + 0.17;
/** Slightly above eye level, so the plinth reads as a disc the organ sits on
 *  rather than an edge-on band across the background. */
const HOME_CAMERA = { x: 0, y: 1.05, z: 8.2 };
const HOME_TARGET = { x: 0, y: 0.02, z: 0 };
const HOME_ROTATION = { x: 0.05, y: -0.28, z: 0 };
const MIN_DISTANCE = 4.2;
const MAX_DISTANCE = 12;

/**
 * Named camera stations. Anatomical rather than technical: a learner asked to
 * check the posterior surface should not have to work out which way to drag.
 */
const VIEWS: Record<ViewName, { position: [number, number, number]; rotation: [number, number, number] }> = {
  anterior: { position: [0, 1.05, 8.2], rotation: [0.05, -0.28, 0] },
  posterior: { position: [0, 1.05, 8.2], rotation: [0.05, Math.PI - 0.28, 0] },
  left: { position: [0, 0.6, 8.2], rotation: [0, -Math.PI / 2, 0] },
  right: { position: [0, 0.6, 8.2], rotation: [0, Math.PI / 2, 0] },
  superior: { position: [0, 7.4, 3.4], rotation: [0, -0.28, 0] },
  inferior: { position: [0, -6.4, 4.4], rotation: [0, -0.28, 0] },
};

/** Palette per theme, so the specimen sits in the same room as the interface. */
const ENVIRONMENTS = {
  light: { top: 0xfff3e4, bottom: 0x6b4f45, plinth: 0xead7c1, shadow: "94, 62, 42", dust: 0xe7a18e, dustOpacity: 0.16 },
  dark: { top: 0x2a3244, bottom: 0x0b0d14, plinth: 0x1d222f, shadow: "4, 6, 12", dust: 0x8fa8d8, dustOpacity: 0.28 },
} as const;

export class AnatomyViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  private controls: OrbitControls;
  private assets: AnatomyAssetManager;
  private hotspots = new HotspotLayer();
  private callbacks: ViewerCallbacks;
  private container: HTMLElement;
  private organ: LoadedOrgan | null = null;
  private plinth!: THREE.Mesh;
  private contactShadow!: THREE.Mesh;
  private dust!: THREE.Points;
  private keyLight!: THREE.DirectionalLight;
  private fillLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;
  private ambient!: THREE.AmbientLight;
  private hemisphere!: THREE.HemisphereLight;

  private frame = 0;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private intersectionObserver: IntersectionObserver;
  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private sectionAxis: SectionAxis = "x";
  private sectionFlipped = false;
  private sectionDepth = 0;
  /** Writes depth only — used to resolve a fading organ to one surface. */
  private depthMaterial = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true });
  private crossSection = false;
  private isolated = false;
  private xray = false;
  private theme: ViewerTheme = "light";

  private width = 1;
  private height = 1;
  private isVisible = true;
  private isPageVisible = true;

  // Render-on-demand bookkeeping: the loop only draws when something moved.
  private dirty = true;
  private busyUntil = 0;
  private loadRequest = 0;

  private quality: Quality = "auto";
  private basePixelRatio = 1;
  private lowPower = false;

  private autoRotateWanted = true;
  private interactionUntil = 0;
  private selectedId: string | null = null;
  private hoveredId: string | null = null;
  private hoverProbe: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private pointerStart = { x: 0, y: 0 };
  private dragged = false;
  private calloutEl: HTMLElement | null = null;
  private fadeTween: gsap.core.Tween | null = null;
  private disposed = false;
  private quizMode = false;
  private authoring = false;
  private measuring = false;
  private measurePoints: THREE.Vector3[] = [];
  private measureLine: THREE.Line | null = null;
  private surfaceRaycaster = new THREE.Raycaster();
  /** Real-world millimetres per model unit, so the measure tool can report a
   *  life-size figure instead of an arbitrary one. */
  private mmPerUnit = 1;

  constructor(container: HTMLElement, callbacks: ViewerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    this.lowPower = window.matchMedia("(max-width: 780px)").matches || (navigator.hardwareConcurrency ?? 8) < 6;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.lowPower,
      alpha: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
      // Required for `toDataURL` to see anything — the default buffer is cleared
      // as soon as the frame is presented.
      preserveDrawingBuffer: true,
    });
    this.applyQuality();
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    // Shadow mapping would render every organ twice per frame; a baked contact
    // shadow gives the same read for free.
    this.renderer.shadowMap.enabled = false;
    this.renderer.localClippingEnabled = true;
    // Localised by the React layer via setCanvasLabel once the dictionary is known.
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D anatomy model");
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.camera.position.set(HOME_CAMERA.x, HOME_CAMERA.y, HOME_CAMERA.z);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = MIN_DISTANCE;
    this.controls.maxDistance = MAX_DISTANCE;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.target.set(HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z);

    this.assets = new AnatomyAssetManager(this.renderer);
    this.buildEnvironment();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible) this.dirty = true;
      },
      { rootMargin: "120px" },
    );
    this.intersectionObserver.observe(container);

    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.controls.addEventListener("start", this.onControlStart);
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("webglcontextlost", this.onContextLost);

    this.resize();
    this.animate();
  }

  // ---------------------------------------------------------------- scene

  private buildEnvironment() {
    const palette = ENVIRONMENTS[this.theme];

    this.ambient = new THREE.AmbientLight(0xffffff, 0.42);
    this.scene.add(this.ambient);
    this.hemisphere = new THREE.HemisphereLight(0xfff8ee, 0x33252d, 0.72);
    this.scene.add(this.hemisphere);

    this.keyLight = new THREE.DirectionalLight(0xfff3e7, 3.5);
    this.keyLight.position.set(4.8, 6.5, 6.8);
    this.scene.add(this.keyLight);
    this.fillLight = new THREE.DirectionalLight(0xe6ecff, 1.12);
    this.fillLight.position.set(-4.5, 1.2, 5.2);
    this.scene.add(this.fillLight);
    this.rimLight = new THREE.DirectionalLight(0xffb7a5, 1.6);
    this.rimLight.position.set(-4, 3.5, -5.5);
    this.scene.add(this.rimLight);
    const warm = new THREE.PointLight(0xff8d70, 0.72, 11, 2);
    warm.position.set(-3, -1.4, 3.5);
    this.scene.add(warm);
    const glow = new THREE.PointLight(0xee7c6a, 0.5, 8, 2);
    glow.name = "organ-glow";
    glow.position.set(2.8, 0.4, 2.8);
    this.scene.add(glow);

    this.scene.environment = this.buildEnvironmentMap();

    this.plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.3, 2.48, 0.34, 56),
      new THREE.MeshStandardMaterial({ color: palette.plinth, roughness: 0.78, metalness: 0 }),
    );
    this.plinth.position.y = PLINTH_Y;
    this.scene.add(this.plinth);

    this.contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      new THREE.MeshBasicMaterial({
        map: contactShadowTexture(palette.shadow),
        transparent: true,
        depthWrite: false,
        opacity: 0.62,
        toneMapped: false,
      }),
    );
    this.contactShadow.rotation.x = -Math.PI / 2;
    this.contactShadow.position.y = PLINTH_TOP + 0.005;
    this.contactShadow.renderOrder = 1;
    this.scene.add(this.contactShadow);

    const positions = new Float32Array(48 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 9;
      positions[i + 1] = (Math.random() - 0.5) * 6;
      positions[i + 2] = (Math.random() - 0.5) * 5 - 2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: palette.dust,
        size: 0.013,
        transparent: true,
        opacity: palette.dustOpacity,
      }),
    );
    this.scene.add(this.dust);
  }

  /** A tiny warm-to-cool gradient probe: better material response than a bare
   *  light rig, and it costs one PMREM bake instead of per-frame work. */
  private buildEnvironmentMap() {
    const palette = ENVIRONMENTS[this.theme];
    const width = 16;
    const height = 32;
    const data = new Uint8Array(width * height * 4);
    const top = new THREE.Color(palette.top);
    const bottom = new THREE.Color(palette.bottom);
    const mixed = new THREE.Color();
    for (let y = 0; y < height; y += 1) {
      mixed.copy(bottom).lerp(top, Math.pow(1 - y / (height - 1), 0.7));
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        data[i] = mixed.r * 255;
        data[i + 1] = mixed.g * 255;
        data[i + 2] = mixed.b * 255;
        data[i + 3] = 255;
      }
    }
    const source = new THREE.DataTexture(data, width, height);
    source.mapping = THREE.EquirectangularReflectionMapping;
    source.colorSpace = THREE.SRGBColorSpace;
    source.needsUpdate = true;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = pmrem.fromEquirectangular(source).texture;
    pmrem.dispose();
    source.dispose();
    return environment;
  }

  /**
   * Repaints the room for a theme change. The organ itself is never re-tinted —
   * specimen colour is anatomical information, so only the surroundings move.
   */
  setTheme(theme: ViewerTheme) {
    if (this.theme === theme) return;
    this.theme = theme;
    const palette = ENVIRONMENTS[theme];
    const dark = theme === "dark";

    (this.plinth.material as THREE.MeshStandardMaterial).color.set(palette.plinth);
    const shadowMaterial = this.contactShadow.material as THREE.MeshBasicMaterial;
    shadowMaterial.map?.dispose();
    shadowMaterial.map = contactShadowTexture(palette.shadow);
    shadowMaterial.needsUpdate = true;
    const dustMaterial = this.dust.material as THREE.PointsMaterial;
    dustMaterial.color.set(palette.dust);
    dustMaterial.opacity = palette.dustOpacity;

    this.ambient.intensity = dark ? 0.3 : 0.42;
    this.hemisphere.color.set(dark ? 0xcdd8f2 : 0xfff8ee);
    this.hemisphere.intensity = dark ? 0.5 : 0.72;
    this.keyLight.intensity = dark ? 3.1 : 3.5;
    this.fillLight.intensity = dark ? 0.85 : 1.12;
    this.rimLight.intensity = dark ? 2.1 : 1.6;
    this.renderer.toneMappingExposure = dark ? 0.94 : 1.02;

    this.scene.environment?.dispose();
    this.scene.environment = this.buildEnvironmentMap();
    this.hotspots.setTheme(theme);
    this.dirty = true;
  }

  setQuality(quality: Quality) {
    if (this.quality === quality) return;
    this.quality = quality;
    this.applyQuality();
    this.resize();
  }

  /**
   * Decided once per setting rather than adapted per frame. A dynamic controller
   * used to live here and it was a net negative: frame *intervals* are
   * vsync-quantised, so a brief hitch read as GPU load, dropped the buffer, and
   * — because a vsync-locked 16.7ms never met the step-up threshold — never
   * recovered. The scene renders in ~2ms, so there is nothing to adapt away from.
   */
  private applyQuality() {
    const ceiling = this.quality === "high" ? 2 : this.quality === "low" ? 1 : this.lowPower ? 1.5 : 2;
    this.basePixelRatio = Math.min(window.devicePixelRatio, ceiling);
    this.renderer.setPixelRatio(this.basePixelRatio);
  }

  // ---------------------------------------------------------------- organs

  prefetch(url: string) {
    this.assets.prefetch(url);
  }

  async setOrgan(modelUrl: string, hotspots: Hotspot[], accent: string, realSizeMm?: number) {
    const request = ++this.loadRequest;
    this.select(null);
    this.clearMeasurement();
    this.callbacks.onLoading(true, 0);
    this.mmPerUnit = realSizeMm ? realSizeMm / FIT_SIZE : 1;

    const outgoing = this.organ;
    if (outgoing) {
      // Switching mid-fade would otherwise leave the tween running and the
      // depth proxies attached to a released organ.
      this.fadeTween?.kill();
      this.fadeTween = null;
      this.setDepthPrepass(outgoing, false);
      this.hotspots.clear();
      this.busy(0.8);
      await gsap.to(outgoing.pivot.scale, {
        x: 0.72, y: 0.72, z: 0.72,
        duration: 0.34,
        ease: "power2.in",
        onUpdate: () => (this.dirty = true),
      });
      this.assets.release(outgoing);
      this.organ = null;
      this.dirty = true;
    }

    this.tween(this.camera.position, { z: 9.2, duration: 0.42, ease: "power2.inOut" });

    let organ: LoadedOrgan;
    try {
      organ = await this.assets.load(modelUrl, (progress) => {
        if (request === this.loadRequest) this.callbacks.onLoading(true, progress);
      });
    } catch (error) {
      if (request === this.loadRequest) {
        this.callbacks.onLoading(false, 0);
        this.callbacks.onError?.(error);
      }
      throw error;
    }
    if (request !== this.loadRequest || this.disposed) return;

    this.organ = organ;
    organ.pivot.scale.setScalar(1);
    organ.pivot.position.set(0, 0, 0);
    this.scene.add(organ.pivot);
    organ.pivot.updateWorldMatrix(true, true);

    // Anchor the dots while the organ is still invisible, then play the intro.
    this.hotspots.attach(organ.pivot, hotspots, organ.meshes);
    this.hotspots.setPixelSize(DOT_PIXELS, this.height, CAMERA_FOV);
    this.hotspots.setTheme(this.theme);
    if (this.crossSection) this.applyClipping(true);
    if (this.xray) this.applyXray(true);

    const glow = this.scene.getObjectByName("organ-glow") as THREE.PointLight | undefined;
    glow?.color.set(accent);

    organ.pivot.scale.setScalar(0.58);
    organ.pivot.position.z = -1.3;
    this.busy(1.4);
    this.fade(organ, 1, 0.72);
    // The organ is on screen from here on, so the load is over as far as the UI
    // is concerned — the intro animation should play in the open, not behind a
    // loading panel.
    this.callbacks.onLoading(false, 1);
    gsap.timeline({ onUpdate: () => (this.dirty = true) })
      .to(organ.pivot.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: "back.out(1.25)" }, 0)
      .to(organ.pivot.position, { z: 0, duration: 0.85, ease: "power3.out" }, 0)
      .to(this.camera.position, { z: 8.2, duration: 0.9, ease: "power2.out" }, 0.08);
  }

  private materials(organ: LoadedOrgan) {
    const list: THREE.Material[] = [];
    organ.meshes.forEach((mesh) => {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => list.includes(material) || list.push(material));
    });
    return list;
  }

  /**
   * Fades an organ in. Depth writing stays ON throughout: these are solid,
   * closed meshes, and letting them blend in draw order instead of depth order
   * makes the far side and interior show through the front for the length of
   * the tween. A depth prepass keeps the result identical to the opaque pass —
   * only the nearest surface is ever shaded.
   */
  private fade(organ: LoadedOrgan, to: number, duration: number) {
    const materials = this.materials(organ);
    const state = { value: to >= 1 ? 0 : 1 };
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = state.value;
      material.depthWrite = true;
    });
    this.setDepthPrepass(organ, true);
    this.busy(duration + 0.1);
    this.fadeTween = gsap.to(state, {
      value: to,
      duration,
      ease: "power2.out",
      onUpdate: () => {
        materials.forEach((material) => (material.opacity = state.value));
        this.dirty = true;
      },
      onComplete: () => {
        if (to >= 1 && !this.xray) {
          materials.forEach((material) => {
            material.transparent = false;
            material.opacity = 1;
            material.depthWrite = true;
          });
        }
        this.setDepthPrepass(organ, false);
        this.fadeTween = null;
        if (this.xray) this.applyXray(true);
        this.dirty = true;
      },
    });
  }

  /**
   * Lays down depth for the organ before it is shaded, so a partly transparent
   * mesh still resolves to a single nearest surface per pixel. The proxy is
   * parented to the mesh it mirrors, so it inherits the intro animation for
   * free. Opaque, therefore drawn before anything transparent. Alive only while
   * an organ fades; it costs one depth-only pass over ~120k triangles.
   */
  private setDepthPrepass(organ: LoadedOrgan, enabled: boolean) {
    organ.meshes.forEach((mesh) => {
      const existing = mesh.children.find((child) => child.name === DEPTH_PREPASS);
      if (!enabled) {
        existing?.removeFromParent();
        return;
      }
      if (existing) return;
      const proxy = new THREE.Mesh(mesh.geometry, this.depthMaterial);
      proxy.name = DEPTH_PREPASS;
      proxy.frustumCulled = mesh.frustumCulled;
      mesh.add(proxy);
    });
  }

  // ---------------------------------------------------------------- loop

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.isVisible || !this.isPageVisible) return;

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    this.applyAutoRotate(now);
    if (this.controls.update(delta)) this.dirty = true;
    if (this.assets.hasAnimation) {
      this.assets.update(delta);
      this.dirty = true;
    }
    if (this.hoverProbe) this.resolveHover();
    if (!this.dirty && now >= this.busyUntil) return;

    if (!this.hotspots.update(this.camera, delta, this.selectedId, this.hoveredId)) this.dirty = true;
    else this.dirty = false;
    if (now < this.busyUntil) this.dirty = true;

    this.positionCallout();
    this.renderer.render(this.scene, this.camera);
  };

  private busy(seconds: number) {
    this.busyUntil = Math.max(this.busyUntil, performance.now() + seconds * 1000);
    this.dirty = true;
  }

  private tween(target: object, vars: gsap.TweenVars) {
    this.busy((vars.duration as number) ?? 0.5);
    return gsap.to(target, { ...vars, onUpdate: () => (this.dirty = true) });
  }

  private applyAutoRotate(now: number) {
    this.controls.autoRotate = this.autoRotateWanted && !this.selectedId && now >= this.interactionUntil;
  }

  private onVisibilityChange = () => {
    this.isPageVisible = !document.hidden;
    if (this.isPageVisible) {
      this.clock.start();
      this.dirty = true;
    }
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.callbacks.onError?.(new Error("WebGL context lost"));
  };

  private resize() {
    this.width = Math.max(this.container.clientWidth, 1);
    this.height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.hotspots.setPixelSize(DOT_PIXELS, this.height, CAMERA_FOV);
    this.dirty = true;
  }

  // ---------------------------------------------------------------- input

  private onControlStart = () => {
    this.interactionUntil = performance.now() + 3000;
    this.dirty = true;
  };

  private onPointerDown = (event: PointerEvent) => {
    this.pointerId = event.pointerId;
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.dragged = false;
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.pointerId !== null) {
      if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 5) this.dragged = true;
      return;
    }
    this.hoverProbe = { x: event.offsetX, y: event.offsetY };
    this.dirty = true;
  };

  private onPointerUp = (event: PointerEvent) => {
    const wasDragging = this.dragged;
    this.pointerId = null;
    this.dragged = false;
    if (wasDragging) return;

    // Surface sampling takes precedence: these modes want a point on the mesh,
    // not the nearest marker.
    if (this.measuring) {
      this.sampleMeasurePoint(event.offsetX, event.offsetY);
      return;
    }
    if (this.authoring) {
      this.captureAuthorPoint(event.offsetX, event.offsetY);
      return;
    }

    const marker = this.hotspots.pick(event.offsetX, event.offsetY, this.camera, this.width, this.height);
    if (this.quizMode) {
      // Every press counts as an answer, so no toggling and no sticky selection.
      if (marker) this.callbacks.onPick?.(marker.hotspot);
      return;
    }
    this.select(marker && marker.hotspot.id !== this.selectedId ? marker.hotspot.id : null);
  };

  /** Raycasts the mesh and returns the hit in pivot space — the coordinate
   *  system `anatomy-data.ts` authors hotspots in. */
  private sampleSurface(px: number, py: number) {
    if (!this.organ) return null;
    const ndc = new THREE.Vector2((px / this.width) * 2 - 1, -(py / this.height) * 2 + 1);
    this.surfaceRaycaster.setFromCamera(ndc, this.camera);
    const hit = this.surfaceRaycaster.intersectObjects(this.organ.meshes, false)[0];
    if (!hit) return null;
    return this.organ.pivot.worldToLocal(hit.point.clone());
  }

  /**
   * Only ever runs on a deliberate click in authoring mode, so its cost never
   * touches the interactive path.
   */
  private captureAuthorPoint(px: number, py: number) {
    const local = this.sampleSurface(px, py);
    if (!local) return;
    this.callbacks.onAuthorPoint?.({
      x: +local.x.toFixed(2),
      y: +local.y.toFixed(2),
      z: +local.z.toFixed(2),
    });
  }

  // ------------------------------------------------------------- measuring

  setMeasuring(enabled: boolean) {
    this.measuring = enabled;
    this.renderer.domElement.style.cursor = enabled ? "crosshair" : "";
    if (!enabled) this.clearMeasurement();
    this.dirty = true;
  }

  clearMeasurement() {
    this.measurePoints = [];
    if (this.measureLine) {
      this.measureLine.removeFromParent();
      this.measureLine.geometry.dispose();
      (this.measureLine.material as THREE.Material).dispose();
      this.measureLine = null;
    }
    this.callbacks.onMeasure?.(null);
    this.dirty = true;
  }

  private sampleMeasurePoint(px: number, py: number) {
    const local = this.sampleSurface(px, py);
    if (!local || !this.organ) return;
    if (this.measurePoints.length >= 2) this.clearMeasurement();
    this.measurePoints.push(local);
    if (this.measurePoints.length < 2) {
      this.dirty = true;
      return;
    }

    const [a, b] = this.measurePoints;
    const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    this.measureLine = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x4fb0c6, transparent: true, opacity: 0.95, depthTest: false }),
    );
    this.measureLine.renderOrder = 20;
    this.organ.pivot.add(this.measureLine);
    this.callbacks.onMeasure?.(a.distanceTo(b) * this.mmPerUnit);
    this.dirty = true;
  }

  /** Where a dot currently sits, as a 0–1 fraction of the viewport height.
   *  Lets the UI place feedback away from the structure it is pointing at. */
  hotspotScreenY(id: string): number | null {
    const point = this.hotspots.screenPosition(id, this.camera, this.width, this.height);
    return point ? point.y / this.height : null;
  }

  setQuizMode(enabled: boolean) {
    this.quizMode = enabled;
    this.select(null);
    this.hotspots.clearFlash();
    this.dirty = true;
  }

  setAuthoring(enabled: boolean) {
    this.authoring = enabled;
    this.renderer.domElement.style.cursor = enabled ? "crosshair" : "";
    this.dirty = true;
  }

  /** Green/red ring on a dot after a quiz answer. */
  flash(id: string, correct: boolean) {
    this.hotspots.flash(id, correct);
    this.busy(1.1);
  }

  private onPointerLeave = () => {
    this.pointerId = null;
    this.hoverProbe = null;
    if (this.hoveredId) {
      this.hoveredId = null;
      this.dirty = true;
    }
  };

  private resolveHover() {
    const probe = this.hoverProbe;
    this.hoverProbe = null;
    if (!probe) return;
    const marker = this.hotspots.pick(probe.x, probe.y, this.camera, this.width, this.height);
    const id = marker?.hotspot.id ?? null;
    if (id === this.hoveredId) return;
    this.hoveredId = id;
    if (!this.measuring && !this.authoring) {
      this.renderer.domElement.style.cursor = id ? "pointer" : "";
    }
    this.dirty = true;
  }

  private select(id: string | null) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.busy(0.4);
    const marker = this.hotspots.list.find((item) => item.hotspot.id === id);
    this.callbacks.onSelect(marker?.hotspot ?? null);
  }

  clearSelection() {
    this.select(null);
  }

  /** Selects from outside the canvas — used by the structure list, the glossary,
   *  and lesson playback. */
  selectHotspot(id: string | null, options: { focus?: boolean } = {}) {
    this.select(id);
    if (id && options.focus) this.focusHotspot(id);
  }

  /**
   * Orbits the camera onto the axis that runs from the specimen's centre out
   * through the structure, so the dot ends up facing the viewer rather than
   * hidden round the back. The organ's own rotation is left alone — spinning the
   * specimen to meet the camera would break the learner's sense of which way is
   * anterior.
   */
  focusHotspot(id: string) {
    const marker = this.hotspots.list.find((item) => item.hotspot.id === id);
    if (!marker || !this.organ) return;

    const world = marker.dot.getWorldPosition(new THREE.Vector3());
    const centre = this.organ.pivot.getWorldPosition(new THREE.Vector3());
    const outward = world.clone().sub(centre);
    if (outward.lengthSq() < 1e-6) outward.set(0, 0, 1);
    outward.normalize();

    const distance = THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target), MIN_DISTANCE, 8.6);
    const destination = centre.clone().addScaledVector(outward, distance).addScaledVector(new THREE.Vector3(0, 1, 0), 0.5);

    this.autoRotateSuspend();
    this.tween(this.camera.position, { x: destination.x, y: destination.y, z: destination.z, duration: 0.85, ease: "power3.out" });
    this.tween(this.controls.target, { x: centre.x, y: centre.y, z: centre.z, duration: 0.85, ease: "power3.out" });
  }

  private autoRotateSuspend() {
    this.interactionUntil = performance.now() + 4200;
  }

  /** The callout is positioned imperatively so tracking a spinning model never
   *  triggers a React render. */
  attachCallout(element: HTMLElement | null) {
    this.calloutEl = element;
    this.positionCallout();
    this.dirty = true;
  }

  private positionCallout() {
    if (!this.calloutEl || !this.selectedId) return;
    const point = this.hotspots.screenPosition(this.selectedId, this.camera, this.width, this.height);
    if (!point) return;
    this.calloutEl.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0)`;
    this.calloutEl.dataset.side = point.x > this.width * 0.6 ? "left" : "right";
    this.calloutEl.dataset.behind = point.opacity < 0.3 ? "true" : "false";
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const pivot = this.organ?.pivot;
    if (event.key === "ArrowLeft" && pivot) pivot.rotation.y -= 0.08;
    if (event.key === "ArrowRight" && pivot) pivot.rotation.y += 0.08;
    if (event.key === "ArrowUp" && pivot) pivot.rotation.x -= 0.06;
    if (event.key === "ArrowDown" && pivot) pivot.rotation.x += 0.06;
    if (event.key === "+" || event.key === "=") this.camera.position.z = Math.max(MIN_DISTANCE, this.camera.position.z - 0.35);
    if (event.key === "-") this.camera.position.z = Math.min(MAX_DISTANCE, this.camera.position.z + 0.35);
    if (event.key === "Escape") this.select(null);
    this.dirty = true;
  };

  // ---------------------------------------------------------------- tools

  setCanvasLabel(label: string) {
    this.renderer.domElement.setAttribute("aria-label", label);
  }

  setAutoRotate(enabled: boolean) {
    this.autoRotateWanted = enabled;
    if (enabled) this.interactionUntil = 0;
    this.dirty = true;
  }

  setLabelsVisible(visible: boolean) {
    this.hotspots.setLabelsVisible(visible);
    this.dirty = true;
  }

  reset() {
    this.select(null);
    this.clearMeasurement();
    this.tween(this.camera.position, { ...HOME_CAMERA, duration: 0.8, ease: "power3.out" });
    this.tween(this.controls.target, { ...HOME_TARGET, duration: 0.8, ease: "power3.out" });
    if (this.organ) this.tween(this.organ.pivot.rotation, { ...HOME_ROTATION, duration: 0.8, ease: "power3.out" });
  }

  /** Moves to a named anatomical station. */
  setView(view: ViewName) {
    const target = VIEWS[view];
    this.select(null);
    this.autoRotateSuspend();
    this.tween(this.camera.position, {
      x: target.position[0], y: target.position[1], z: target.position[2],
      duration: 0.85, ease: "power3.out",
    });
    this.tween(this.controls.target, { ...HOME_TARGET, duration: 0.85, ease: "power3.out" });
    if (this.organ) {
      this.tween(this.organ.pivot.rotation, {
        x: target.rotation[0], y: target.rotation[1], z: target.rotation[2],
        duration: 0.9, ease: "power3.out",
      });
    }
  }

  zoom(direction: 1 | -1) {
    this.tween(this.camera.position, {
      z: THREE.MathUtils.clamp(this.camera.position.z + direction * 1.2, MIN_DISTANCE, MAX_DISTANCE),
      duration: 0.5,
      ease: "power2.out",
    });
  }

  toggleIsolate() {
    this.isolated = !this.isolated;
    const plinth = this.plinth.material as THREE.MeshStandardMaterial;
    plinth.transparent = true;
    this.tween(plinth, { opacity: this.isolated ? 0.15 : 1, duration: 0.45 });
    this.tween(this.contactShadow.material, { opacity: this.isolated ? 0.08 : 0.55, duration: 0.45 });
    return this.isolated;
  }

  /**
   * X-ray keeps the depth prepass permanently attached, which is what makes a
   * see-through organ readable: without it the interior blends in draw order
   * and the far wall paints over the near one.
   */
  toggleXray() {
    this.xray = !this.xray;
    this.applyXray(this.xray);
    return this.xray;
  }

  private applyXray(enabled: boolean) {
    if (!this.organ) return;
    this.materials(this.organ).forEach((material) => {
      material.transparent = enabled;
      material.opacity = enabled ? 0.42 : 1;
      material.depthWrite = true;
      material.needsUpdate = true;
    });
    this.setDepthPrepass(this.organ, enabled);
    this.dirty = true;
  }

  toggleCrossSection() {
    this.crossSection = !this.crossSection;
    this.applyClipping(this.crossSection);
    if (this.crossSection) {
      this.sectionDepth = 0;
      gsap.fromTo(
        this.clipPlane,
        { constant: -1.8 },
        { constant: 0, duration: 0.85, ease: "power2.inOut", onUpdate: () => (this.dirty = true) },
      );
      this.busy(0.95);
    }
    return this.crossSection;
  }

  /** Slides the cut without rebuilding it — the slider drags this. */
  setSectionDepth(depth: number) {
    this.sectionDepth = THREE.MathUtils.clamp(depth, -1.9, 1.9);
    this.updateClipPlane();
  }

  setSectionAxis(axis: SectionAxis) {
    this.sectionAxis = axis;
    this.updateClipPlane();
  }

  flipSection() {
    this.sectionFlipped = !this.sectionFlipped;
    this.updateClipPlane();
    return this.sectionFlipped;
  }

  private updateClipPlane() {
    const sign = this.sectionFlipped ? 1 : -1;
    const normal =
      this.sectionAxis === "x" ? new THREE.Vector3(sign, 0, 0)
      : this.sectionAxis === "y" ? new THREE.Vector3(0, sign, 0)
      : new THREE.Vector3(0, 0, sign);
    this.clipPlane.normal.copy(normal);
    this.clipPlane.constant = this.sectionDepth * sign * -1;
    this.dirty = true;
  }

  private applyClipping(enabled: boolean) {
    if (!this.organ) return;
    const planes = enabled ? [this.clipPlane] : null;
    [...this.materials(this.organ), this.depthMaterial].forEach((material) => {
      material.clippingPlanes = planes;
      material.needsUpdate = true;
    });
    this.dirty = true;
  }

  toggleLayers() {
    if (!this.organ) return false;
    let enabled = false;
    this.materials(this.organ).forEach((material) => {
      if (material instanceof THREE.MeshStandardMaterial) {
        material.wireframe = !material.wireframe;
        enabled = material.wireframe;
      }
    });
    this.dirty = true;
    return enabled;
  }

  /**
   * Renders one fresh frame before reading the buffer. `preserveDrawingBuffer`
   * makes the read legal, but the last presented frame may predate the tool the
   * learner just used.
   */
  capture(): string | null {
    try {
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL("image/png");
    } catch {
      return null;
    }
  }

  dispose() {
    this.disposed = true;
    this.loadRequest += 1;
    cancelAnimationFrame(this.frame);
    gsap.killTweensOf(this.camera.position);
    this.controls.removeEventListener("start", this.onControlStart);
    this.controls.dispose();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);

    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("keydown", this.onKeyDown);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);

    this.clearMeasurement();
    this.hotspots.dispose();
    this.depthMaterial.dispose();
    this.assets.dispose();
    this.scene.environment?.dispose();
    (this.contactShadow.material as THREE.MeshBasicMaterial).map?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }
}

function contactShadowTexture(rgb: string) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
  gradient.addColorStop(0, `rgba(${rgb}, 0.62)`);
  gradient.addColorStop(0.45, `rgba(${rgb}, 0.26)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Whether the device can render the specimen at all. */
export function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
