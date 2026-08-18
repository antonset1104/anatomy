/**
 * Invariants over the anatomy dataset and the layers derived from it. These are
 * the assumptions the viewer, the quiz, and the lessons all rely on and none of
 * them can express in a type.
 */
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import {
  organStructures,
  systemStructures,
  totalStructures,
  structureById,
} from "../app/lib/anatomy-data.ts";
import { organs as enOrgans } from "../app/i18n/organs/en.ts";
import { ui as enUi } from "../app/i18n/ui/en.ts";
import { buildGlossary, buildOrgans, buildSystems } from "../app/i18n/merge.ts";
import { buildGrandTour, buildLesson } from "../app/lib/lessons.ts";
import { buildQuestions } from "../app/lib/quiz.ts";
import { deepMerge } from "../app/i18n/deep-merge.ts";

const HEX = /^#[0-9a-f]{6}$/i;
const FIT_HALF = 1.9;

test("every specimen ships the assets it claims", async () => {
  for (const organ of organStructures) {
    await access(new URL(`../public${organ.model}`, import.meta.url));
    if (!organ.illustrated) continue;
    for (const asset of ["thumb", "organ", "microscopic", "compare", "location"]) {
      await access(new URL(`../public/anatomy/${organ.id}/${asset}.webp`, import.meta.url));
    }
  }
});

test("hotspot ids are unique and sit inside the normalised model cube", () => {
  for (const organ of organStructures) {
    const ids = organ.hotspots.map((hotspot) => hotspot.id);
    assert.deepEqual([...new Set(ids)], ids, `${organ.id} has duplicate hotspot ids`);
    assert.ok(organ.hotspots.length >= 3, `${organ.id} needs at least three teachable structures`);

    for (const hotspot of organ.hotspots) {
      assert.match(hotspot.color, HEX, `${organ.id}.${hotspot.id} has a non-hex colour`);
      assert.ok(hotspot.ta.length > 0, `${organ.id}.${hotspot.id} is missing its TA term`);
      for (const axis of hotspot.position) {
        assert.ok(
          Number.isFinite(axis) && Math.abs(axis) <= FIT_HALF,
          `${organ.id}.${hotspot.id} is authored outside the model cube`,
        );
      }
    }
  }
});

test("metrics are drawable and their bands sit inside the scale", () => {
  for (const organ of organStructures) {
    for (const metric of organ.metrics) {
      assert.ok(metric.max > 0, `${organ.id}.${metric.id} has no ceiling`);
      assert.ok(metric.value > 0 && metric.value <= metric.max, `${organ.id}.${metric.id} overflows its bar`);
      assert.ok(metric.unit.length > 0, `${organ.id}.${metric.id} has no unit`);
      if (!metric.band) continue;
      const [low, high] = metric.band;
      assert.ok(low < high, `${organ.id}.${metric.id} has an inverted band`);
      assert.ok(high <= metric.max, `${organ.id}.${metric.id} band exceeds its ceiling`);
    }
    assert.ok(organ.realSizeMm > 0, `${organ.id} needs a real size for the measure tool`);
  }
});

test("the taxonomy is closed in both directions", () => {
  const claimed = systemStructures.flatMap((system) => system.organs);
  assert.deepEqual([...new Set(claimed)].sort(), [...claimed].sort(), "an organ is listed in two systems");

  for (const organ of organStructures) {
    const system = systemStructures.find((entry) => entry.id === organ.system);
    assert.ok(system, `${organ.id} points at an unknown system`);
    assert.ok(system.organs.includes(organ.id), `${organ.system} does not list ${organ.id}`);
    for (const related of organ.related) {
      assert.ok(structureById[related], `${organ.id} relates to an unknown specimen ${related}`);
      assert.notEqual(related, organ.id, `${organ.id} relates to itself`);
    }
  }

  assert.equal(
    totalStructures,
    organStructures.reduce((sum, organ) => sum + organ.hotspots.length, 0),
  );
});

test("English carries a label and a role for every structure and metric", () => {
  for (const organ of organStructures) {
    const prose = enOrgans[organ.id];
    assert.ok(prose, `en is missing ${organ.id}`);
    for (const hotspot of organ.hotspots) {
      const entry = prose.hotspots[hotspot.id];
      assert.ok(entry?.label, `en is missing a label for ${organ.id}.${hotspot.id}`);
      assert.ok(entry?.detail, `en is missing a role for ${organ.id}.${hotspot.id}`);
    }
    for (const metric of organ.metrics) {
      assert.ok(enUi.metrics[`${organ.id}.${metric.id}`], `en is missing metrics.${organ.id}.${metric.id}`);
    }
    assert.ok(enUi.systemNames[organ.system], `en is missing systemNames.${organ.system}`);
  }
});

test("the merge layer falls back to English rather than rendering blanks", () => {
  const patched = deepMerge(enOrgans, { heart: { name: "Jantung", hotspots: { aorta: { label: "Aorta" } } } });
  assert.equal(patched.heart.name, "Jantung");
  // A patch that supplies only a label keeps the English role underneath.
  assert.equal(patched.heart.hotspots.aorta.detail, enOrgans.heart.hotspots.aorta.detail);
  // Untouched specimens survive intact.
  assert.equal(patched.brain.name, enOrgans.brain.name);

  const organs = buildOrgans(enOrgans, enUi);
  for (const organ of organs) {
    for (const hotspot of organ.hotspots) {
      assert.ok(hotspot.label.length > 0, `${organ.id}.${hotspot.id} rendered an empty label`);
      assert.ok(hotspot.detail.length > 0, `${organ.id}.${hotspot.id} rendered an empty role`);
    }
    for (const metric of organ.metrics) {
      assert.notEqual(metric.label, metric.id, `${organ.id}.${metric.id} fell through to its raw id`);
    }
  }

  assert.equal(buildSystems(enUi).length, systemStructures.length);
  assert.equal(buildGlossary(organs).length, totalStructures);
});

test("lessons walk every structure, hardest-taught first", () => {
  const organs = buildOrgans(enOrgans, enUi);
  for (const organ of organs) {
    const lesson = buildLesson(organ);
    assert.equal(lesson.steps.length, organ.hotspots.length, `${organ.id} lesson skips a structure`);
    const weights = lesson.steps.map(
      (step) => organ.hotspots.find((hotspot) => hotspot.id === step.hotspotId)?.weight ?? 1,
    );
    assert.deepEqual(weights, [...weights].sort((a, b) => b - a), `${organ.id} lesson is out of order`);
    for (const step of lesson.steps) assert.ok(step.label && step.detail, "a lesson step lost its narration");
  }

  const tour = buildGrandTour(organs, "Grand tour", "One each");
  assert.equal(tour.steps.length, organs.length);
  assert.equal(new Set(tour.steps.map((step) => step.organId)).size, organs.length);
});

test("quiz questions always contain their own answer", () => {
  const organs = buildOrgans(enOrgans, enUi);
  const heart = organs.find((organ) => organ.id === "heart");

  const labelled = buildQuestions(organs, "label", heart);
  assert.ok(labelled.length > 0);
  for (const question of labelled) {
    assert.equal(question.organId, "heart", "label mode asked about an off-screen specimen");
    assert.equal(question.options.length, 0, "label mode is answered on the model, not from a list");
  }

  for (const mode of ["choice", "match"]) {
    for (const scope of [heart, null]) {
      const questions = buildQuestions(organs, mode, scope);
      assert.ok(questions.length > 0, `${mode} produced no questions`);
      for (const question of questions) {
        assert.ok(question.options.length >= 2, `${mode} needs at least two options to be a question`);
        assert.ok(
          question.options.some((option) => option.id === question.answerId),
          `${mode} dropped the correct answer`,
        );
        const texts = question.options.map((option) => option.text);
        assert.deepEqual([...new Set(texts)], texts, `${mode} offered the same answer twice`);
      }
    }
  }
});
