import * as THREE from "three";
import type { Hotspot } from "../../i18n/merge";

export type Marker = {
  hotspot: Hotspot;
  dot: THREE.Sprite;
  pulse: THREE.Sprite;
  /** Pinned name, built lazily the first time labels are switched on. */
  label: THREE.Sprite | null;
  /** Width/height of the label texture, so the sprite keeps its proportions. */
  labelAspect: number;
  /** The point on the mesh this marker belongs to, in pivot space. */
  anchor: THREE.Vector3;
  /** Current facing/occlusion fade, 0–1. */
  opacity: number;
  /** Hover + selection emphasis, 0–1. */
  emphasis: number;
};

const TAU = Math.PI * 2;
/** A hair off the mesh, just enough to avoid z-fighting with the skin. */
const SURFACE_LIFT = 0.02;
/**
 * Markers are additionally floated along the view ray. Moving towards the
 * camera leaves the on-screen position untouched — so a dot never drifts off a
 * thin ureter — while giving it enough depth clearance that local relief (a
 * gyrus, a coronary vessel) cannot nibble the billboard. Real geometry in
 * front, like a loop of bowel, still occludes it.
 */
const VIEW_LIFT = 0.3;
/** The selection ring beats for a few seconds and then rests, so an open
 *  callout does not keep the renderer awake indefinitely. */
const PULSE_SECONDS = 4.5;
/** How long a quiz answer stays tinted on the dot. */
const FLASH_SECONDS = 1.8;
const FLASH_CORRECT = "#5c9e6b";
const FLASH_WRONG = "#d1584f";
/** Cap height of a pinned label, in CSS pixels. */
const LABEL_PIXELS = 15;
const DOT_PIXELS = 34;

const LABEL_THEME = {
  light: { fill: "rgba(255, 252, 246, 0.94)", stroke: "rgba(117, 91, 70, 0.28)", text: "#2f2a27" },
  dark: { fill: "rgba(18, 21, 30, 0.92)", stroke: "rgba(180, 198, 232, 0.26)", text: "#e8ecf6" },
} as const;

function rgba(color: THREE.Color, alpha: number) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function dotTexture(hex: string) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  const color = new THREE.Color(hex);

  const halo = ctx.createRadialGradient(c, c, size * 0.3, c, c, size * 0.5);
  halo.addColorStop(0, rgba(color, 0.4));
  halo.addColorStop(0.5, rgba(color, 0.14));
  halo.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, size * 0.3, 0, TAU);
  ctx.fillStyle = "rgba(48, 32, 24, 0.22)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, size * 0.285, 0, TAU);
  ctx.fillStyle = "rgba(255, 253, 249, 0.97)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, size * 0.185, 0, TAU);
  ctx.fillStyle = rgba(color, 1);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function ringTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const c = size / 2;
  ctx.strokeStyle = "rgba(255, 255, 255, 1)";
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.42, 0, TAU);
  ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A pinned name, drawn as a pill so it stays readable over any tissue colour.
 * Rendered at 3× and downsampled by the mipmap chain, which is cheaper than a
 * DOM overlay per structure and needs no per-frame layout.
 */
function labelTexture(text: string, accent: string, theme: "light" | "dark") {
  const scale = 3;
  const fontSize = 15 * scale;
  const padX = 11 * scale;
  const padY = 7 * scale;
  const dotSize = 6 * scale;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const textWidth = measure.measureText(text).width;

  const width = Math.ceil(textWidth + padX * 2 + dotSize + 6 * scale);
  const height = Math.ceil(fontSize + padY * 2);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const palette = LABEL_THEME[theme];
  const radius = height / 2;

  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, radius);
  ctx.fillStyle = palette.fill;
  ctx.fill();
  ctx.lineWidth = 1 * scale;
  ctx.strokeStyle = palette.stroke;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(padX + dotSize / 2, height / 2, dotSize / 2, 0, TAU);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.font = `500 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = palette.text;
  ctx.textBaseline = "middle";
  ctx.fillText(text, padX + dotSize + 6 * scale, height / 2 + 1 * scale);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return { texture, aspect: width / height };
}

/**
 * Draws the anatomy labels as dots that live in the 3D scene rather than as
 * DOM overlays. Occlusion comes from the depth buffer plus a per-frame facing
 * test, so nothing has to raycast the mesh while the model spins.
 */
export class HotspotLayer {
  private markers: Marker[] = [];
  private ring = ringTexture();
  private group = new THREE.Group();
  private pixelScale = 0.021;
  private time = 0;
  private selectedAt = -PULSE_SECONDS;
  private lastSelectedId: string | null = null;
  private labelsVisible = false;
  private theme: "light" | "dark" = "light";
  /** Quiz answer feedback. Holds more than one dot so a wrong answer can mark
   *  the miss in red *and* the real answer in green at the same time. */
  private flashes = new Map<string, { correct: boolean; until: number }>();

  private readonly world = new THREE.Vector3();
  private readonly toCamera = new THREE.Vector3();
  private readonly outward = new THREE.Vector3();
  private readonly center = new THREE.Vector3();
  private readonly projected = new THREE.Vector3();
  private readonly localCamera = new THREE.Vector3();
  private readonly lift = new THREE.Vector3();

  constructor() {
    this.group.name = "hotspot-layer";
    this.group.renderOrder = 10;
  }

  get list(): readonly Marker[] {
    return this.markers;
  }

  attach(pivot: THREE.Group, hotspots: Hotspot[], meshes: THREE.Mesh[]) {
    this.clear();
    if (!hotspots.length) return;

    const anchors = snapToSurface(hotspots, pivot, meshes);
    hotspots.forEach((hotspot, index) => {
      const dot = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: dotTexture(hotspot.color),
          transparent: true,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: false,
          toneMapped: false,
          // Bias the billboard towards the camera so it is not nibbled by the
          // surface it is sitting on.
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -12,
        }),
      );
      dot.position.copy(anchors[index]);
      dot.renderOrder = 11;

      const pulse = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.ring,
          color: new THREE.Color(hotspot.color),
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true,
          sizeAttenuation: false,
          toneMapped: false,
        }),
      );
      pulse.position.copy(anchors[index]);
      pulse.renderOrder = 10;

      this.group.add(pulse, dot);
      this.markers.push({
        hotspot, dot, pulse, label: null, labelAspect: 1,
        anchor: anchors[index].clone(), opacity: 0, emphasis: 0,
      });
    });

    this.group.position.set(0, 0, 0);
    pivot.add(this.group);
    if (this.labelsVisible) this.buildLabels();
    this.applyScale();
  }

  setTheme(theme: "light" | "dark") {
    if (this.theme === theme) return;
    this.theme = theme;
    if (!this.labelsVisible) return;
    this.destroyLabels();
    this.buildLabels();
  }

  setLabelsVisible(visible: boolean) {
    if (this.labelsVisible === visible) return;
    this.labelsVisible = visible;
    if (visible) this.buildLabels();
    else this.destroyLabels();
  }

  private buildLabels() {
    this.markers.forEach((marker) => {
      if (marker.label) return;
      const { texture, aspect } = labelTexture(marker.hotspot.label, marker.hotspot.color, this.theme);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          sizeAttenuation: false,
          toneMapped: false,
        }),
      );
      // Anchored below its own box, which lifts the pill clear of the dot
      // without any per-frame world-space maths.
      sprite.center.set(0.5, -0.55);
      sprite.renderOrder = 12;
      sprite.position.copy(marker.dot.position);
      marker.label = sprite;
      marker.labelAspect = aspect;
      this.group.add(sprite);
    });
    this.applyScale();
  }

  private destroyLabels() {
    this.markers.forEach((marker) => {
      if (!marker.label) return;
      marker.label.removeFromParent();
      marker.label.material.map?.dispose();
      marker.label.material.dispose();
      marker.label = null;
    });
  }

  flash(id: string, correct: boolean) {
    this.flashes.set(id, { correct, until: this.time + FLASH_SECONDS });
  }

  clearFlash() {
    this.flashes.clear();
  }

  /** Keeps dots at a constant on-screen size regardless of zoom or viewport. */
  setPixelSize(pixels: number, viewportHeight: number, fovDegrees: number) {
    const fov = THREE.MathUtils.degToRad(fovDegrees);
    this.pixelScale = 2 * (pixels / Math.max(viewportHeight, 1)) * Math.tan(fov / 2);
    this.applyScale();
  }

  private applyScale() {
    const labelScale = (this.pixelScale / DOT_PIXELS) * LABEL_PIXELS * 1.9;
    this.markers.forEach((marker) => {
      // Dots keep most of their size as they fade so they stay readable right
      // up to the silhouette instead of shrinking into specks.
      const scale = this.pixelScale * (1 + marker.emphasis * 0.3) * (0.74 + 0.26 * marker.opacity);
      marker.dot.scale.setScalar(scale);
      if (marker.label) marker.label.scale.set(labelScale * marker.labelAspect, labelScale, 1);
    });
  }

  /**
   * Fades markers that have rotated to the far side and animates the selected
   * ring. Returns false while values are still easing so the viewer knows it
   * has to schedule another frame.
   */
  update(camera: THREE.Camera, delta: number, selectedId: string | null, hoveredId: string | null) {
    if (!this.markers.length) return true;
    this.time += delta;
    this.group.updateWorldMatrix(true, false);
    this.group.getWorldPosition(this.center);
    this.localCamera.copy(camera.position);
    this.group.worldToLocal(this.localCamera);

    if (selectedId !== this.lastSelectedId) {
      this.lastSelectedId = selectedId;
      this.selectedAt = this.time;
    }
    const beating = this.time - this.selectedAt < PULSE_SECONDS;

    let settled = true;
    for (const marker of this.markers) {
      // Float along the view ray: same pixel, more depth clearance.
      this.lift.copy(this.localCamera).sub(marker.anchor);
      const span = this.lift.length();
      if (span > 1e-4) this.lift.multiplyScalar(VIEW_LIFT / span);
      else this.lift.set(0, 0, 0);
      marker.dot.position.copy(marker.anchor).add(this.lift);
      marker.pulse.position.copy(marker.dot.position);
      marker.label?.position.copy(marker.dot.position);

      marker.dot.getWorldPosition(this.world);
      this.outward.copy(this.world).sub(this.center);
      const radius = this.outward.length();
      this.toCamera.copy(camera.position).sub(this.world).normalize();
      const facing = radius > 1e-4 ? this.outward.divideScalar(radius).dot(this.toCamera) : 1;
      const target = THREE.MathUtils.smoothstep(facing, -0.05, 0.3);

      const active = marker.hotspot.id === selectedId || marker.hotspot.id === hoveredId;
      const emphasisTarget = active ? 1 : 0;
      const ease = 1 - Math.exp(-delta * 12);

      if (Math.abs(target - marker.opacity) > 0.002) settled = false;
      if (Math.abs(emphasisTarget - marker.emphasis) > 0.002) settled = false;
      marker.opacity += (target - marker.opacity) * ease;
      marker.emphasis += (emphasisTarget - marker.emphasis) * ease;

      marker.dot.material.opacity = marker.opacity;
      marker.dot.visible = marker.opacity > 0.01;
      if (marker.label) {
        // Labels are dropped earlier than dots: a pill crossing the silhouette
        // reads as belonging to whatever is behind it.
        marker.label.material.opacity = Math.max(0, marker.opacity * 1.4 - 0.5);
        marker.label.visible = marker.label.material.opacity > 0.02;
      }

      const pending = this.flashes.get(marker.hotspot.id);
      const flash = pending && this.time < pending.until ? pending : null;
      if (flash) {
        const life = (flash.until - this.time) / FLASH_SECONDS;
        marker.pulse.visible = true;
        marker.pulse.material.color.set(flash.correct ? FLASH_CORRECT : FLASH_WRONG);
        // Holds near full strength, then releases — a quick fade is easy to miss.
        marker.pulse.material.opacity = Math.min(1, life * 2.2) * marker.opacity;
        marker.pulse.scale.setScalar(this.pixelScale * (1.35 + (1 - life) * 2.1));
        settled = false;
      } else if (marker.emphasis > 0.01) {
        marker.pulse.material.color.set(marker.hotspot.color);
        marker.pulse.visible = true;
        if (beating || marker.hotspot.id === hoveredId) {
          const beat = (this.time * 0.75) % 1;
          marker.pulse.material.opacity = marker.emphasis * marker.opacity * (1 - beat) * 0.85;
          marker.pulse.scale.setScalar(this.pixelScale * (1.15 + beat * 1.5));
          settled = false;
        } else {
          marker.pulse.material.opacity = marker.emphasis * marker.opacity * 0.42;
          marker.pulse.scale.setScalar(this.pixelScale * 1.6);
        }
      } else if (marker.pulse.visible) {
        marker.pulse.material.color.set(marker.hotspot.color);
        marker.pulse.visible = false;
      }
    }
    this.applyScale();
    return settled;
  }

  /** Screen-space picking: one projection per marker, no mesh raycast. */
  pick(x: number, y: number, camera: THREE.Camera, width: number, height: number, radius = 24) {
    let best: Marker | null = null;
    let bestDistance = radius;
    for (const marker of this.markers) {
      if (marker.opacity < 0.35) continue;
      marker.dot.getWorldPosition(this.projected).project(camera as THREE.PerspectiveCamera);
      if (this.projected.z > 1) continue;
      const px = (this.projected.x * 0.5 + 0.5) * width;
      const py = (-this.projected.y * 0.5 + 0.5) * height;
      const distance = Math.hypot(px - x, py - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = marker;
      }
    }
    return best;
  }

  screenPosition(id: string, camera: THREE.PerspectiveCamera, width: number, height: number) {
    const marker = this.markers.find((item) => item.hotspot.id === id);
    if (!marker) return null;
    marker.dot.getWorldPosition(this.projected).project(camera);
    return {
      x: (this.projected.x * 0.5 + 0.5) * width,
      y: (-this.projected.y * 0.5 + 0.5) * height,
      opacity: marker.opacity,
    };
  }

  clear() {
    this.destroyLabels();
    this.markers.forEach((marker) => {
      marker.dot.material.map?.dispose();
      marker.dot.material.dispose();
      marker.pulse.material.dispose();
    });
    this.markers = [];
    this.group.clear();
    this.group.removeFromParent();
  }

  dispose() {
    this.clear();
    this.ring.dispose();
  }
}

/** Cones, tightest first, used to keep a dot on the side of the organ the
 *  anatomy data actually points at. The last one accepts anything. */
const DIRECTION_CONES = [0.94, 0.82, 0.6, -1.1];

type Candidate = { distance: number; mesh: THREE.Mesh; index: number; point: THREE.Vector3 };

/**
 * Moves each authored hotspot onto the mesh shell so dots sit on the organ
 * instead of floating inside it. Picking the nearest vertex alone can snap a
 * dot through to the far side, so candidates are first filtered by direction
 * from the organ's centre and only then by distance.
 *
 * One linear pass over the vertices, run once per organ — far cheaper and
 * steadier than raycasting a mesh every frame.
 */
function snapToSurface(hotspots: Hotspot[], pivot: THREE.Group, meshes: THREE.Mesh[]) {
  const targets = hotspots.map((hotspot) => new THREE.Vector3(...hotspot.position));
  const directions = targets.map((target) => target.clone().normalize());
  const tiers: (Candidate | null)[][] = hotspots.map(() => DIRECTION_CONES.map(() => null));
  if (!meshes.length) return targets;

  pivot.updateWorldMatrix(true, true);
  const toPivot = new THREE.Matrix4().copy(pivot.matrixWorld).invert();
  const local = new THREE.Matrix4();
  const vertex = new THREE.Vector3();

  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute("position");
    if (!position) continue;
    local.multiplyMatrices(toPivot, mesh.matrixWorld);

    for (let i = 0; i < position.count; i += 1) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(local);
      const radius = vertex.length();
      for (let h = 0; h < targets.length; h += 1) {
        const distance = vertex.distanceToSquared(targets[h]);
        const cosine = radius > 1e-5 ? vertex.dot(directions[h]) / radius : 1;
        for (let t = 0; t < DIRECTION_CONES.length; t += 1) {
          if (cosine < DIRECTION_CONES[t]) continue;
          const best = tiers[h][t];
          if (best && best.distance <= distance) continue;
          if (best) {
            best.distance = distance;
            best.mesh = mesh;
            best.index = i;
            best.point.copy(vertex);
          } else {
            tiers[h][t] = { distance, mesh, index: i, point: vertex.clone() };
          }
        }
      }
    }
  }

  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  return targets.map((target, h) => {
    const chosen = tiers[h].find(Boolean);
    if (!chosen) return target;
    const normals = chosen.mesh.geometry.getAttribute("normal");
    if (normals) {
      local.multiplyMatrices(toPivot, chosen.mesh.matrixWorld);
      normalMatrix.getNormalMatrix(local);
      normal.fromBufferAttribute(normals, chosen.index).applyMatrix3(normalMatrix).normalize();
    } else {
      normal.copy(chosen.point).normalize();
    }
    // Lift outwards even when the nearest triangle happens to face inwards.
    if (normal.dot(chosen.point) < 0) normal.negate();
    return chosen.point.addScaledVector(normal, SURFACE_LIFT);
  });
}
