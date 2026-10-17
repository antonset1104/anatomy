import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getStudyModules, studyLanguages } from "../app/lib/medical-study.ts";
import { localeCodes } from "../app/i18n/config.ts";
import { supportCopy } from "../app/lib/support.ts";

test("study questions retain their identifiers and correct-answer meaning across languages", () => {
  const english = getStudyModules("en");
  for (const language of studyLanguages) {
    const translated = getStudyModules(language);
    assert.deepEqual(translated.map(m => m.id), english.map(m => m.id));
    const ids = translated.flatMap(m => m.questions.map(q => q.id));
    assert.equal(new Set(ids).size, ids.length);
    translated.forEach((m, index) => {
      assert.ok(m.sections.length >= 2 && m.sources.length > 0);
      m.questions.forEach((q, qi) => {
        assert.ok(q.answer >= 0 && q.answer < q.options.length);
        assert.equal(q.answer, english[index].questions[qi].answer);
        assert.ok(q.explanation.length > 30);
      });
    });
  }
});

test("all site languages have complete support copy", () => {
  for (const locale of localeCodes) {
    assert.deepEqual(Object.keys(supportCopy[locale]).sort(), Object.keys(supportCopy.en).sort());
    assert.ok(Object.values(supportCopy[locale]).every(value => value.trim().length > 0));
  }
});

test("exported study pages advertise only available translations and support pages stay ad-free", async () => {
  const root = new URL("../dist/client/", import.meta.url);
  for (const lang of studyLanguages) {
    for (const lesson of getStudyModules(lang)) {
      const html = await readFile(new URL(`${lang}/study/${lesson.id}.html`, root), "utf8");
      assert.match(html, /LearningResource/);
      assert.ok(html.includes(lesson.title.replaceAll('&', '&amp;')));
      assert.doesNotMatch(html, /hreflang="ja"[^>]*\/study\//i);
      assert.doesNotMatch(html, /lastReviewed|reviewedBy/);
    }
  }
  for (const locale of localeCodes) {
    for (const route of ["contact", "donate"]) {
      const html = await readFile(new URL(`${locale}/${route}.html`, root), "utf8");
      assert.doesNotMatch(html, /adsbygoogle\.js|vijeron-ads\.js/);
      assert.match(html, route === "contact" ? /mailto:anton@vijeron\.com/ : /setiawan\.anton@gmail\.com/);
      if (route === "donate") assert.match(html, /noindex/);
    }
  }
});
