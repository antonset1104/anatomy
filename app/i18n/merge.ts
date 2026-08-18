import {
  organStructures,
  systemStructures,
  type HotspotStructure,
  type Metric,
  type OrganId,
  type OrganStructure,
  type SystemId,
  type SystemStructure,
} from "../lib/anatomy-data";
import type { OrganContentDictionary, UiDictionary } from "./types";

/** Structure joined with the active locale's prose. Components consume this
 *  shape, so they never need to know a translation layer exists. */
export type Hotspot = HotspotStructure & { label: string; detail: string };
export type LabelledMetric = Metric & { label: string };
export type Organ = Omit<OrganStructure, "hotspots" | "metrics" | "system"> &
  Omit<OrganContentDictionary[OrganId], "hotspots"> & {
    systemId: SystemId;
    hotspots: Hotspot[];
    metrics: LabelledMetric[];
  };

export type System = SystemStructure & { name: string; role: string };

export function buildOrgans(content: OrganContentDictionary, ui: UiDictionary): Organ[] {
  return organStructures.map((structure) => {
    const { system, ...rest } = structure;
    const prose = content[structure.id];
    return {
      ...rest,
      ...prose,
      systemId: system,
      hotspots: structure.hotspots.map((hotspot) => ({
        ...hotspot,
        // Fall back to the Latin term if a locale has not translated this
        // structure yet — never render an empty label.
        label: prose.hotspots[hotspot.id]?.label ?? hotspot.ta,
        detail: prose.hotspots[hotspot.id]?.detail ?? hotspot.ta,
      })),
      metrics: structure.metrics.map((metric) => ({
        ...metric,
        label: ui.metrics[`${structure.id}.${metric.id}`] ?? metric.id,
      })),
    };
  });
}

export function indexOrgans(organs: Organ[]): Record<OrganId, Organ> {
  return Object.fromEntries(organs.map((organ) => [organ.id, organ])) as Record<OrganId, Organ>;
}

export function buildSystems(ui: UiDictionary): System[] {
  return systemStructures.map((system) => ({
    ...system,
    name: ui.systemNames[system.id]?.name ?? system.id,
    role: ui.systemNames[system.id]?.role ?? "",
  }));
}

/** Every labelled structure across every specimen, for the glossary and the
 *  cross-specimen quiz pools. */
export type GlossaryEntry = { organ: Organ; hotspot: Hotspot };

export function buildGlossary(organs: Organ[]): GlossaryEntry[] {
  return organs
    .flatMap((organ) => organ.hotspots.map((hotspot) => ({ organ, hotspot })))
    .sort((a, b) => a.hotspot.label.localeCompare(b.hotspot.label));
}
