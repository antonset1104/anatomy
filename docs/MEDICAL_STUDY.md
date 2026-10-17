# Medical student learning hub

Published routes:

- `/en/study` and `/id/study`: eight modules, mixed practice, sixteen questions and corresponding recall cards, module completion and a suggested review plan.
- `/en/study/[module]` and `/id/study/[module]`: objectives, original teaching explanations, practical reasoning exercises, references and relevant studio links.
- `/{locale}/donate` and `/{locale}/contact`: localized in all twelve supported site languages. These pages do not load advertising scripts. Donation pages are `noindex,follow` and excluded from the sitemap.
- Other study landing languages explain the available English/Indonesian editions; these language availability pages are not indexed. They do not pretend that English medical text is translated.

## Editorial scope

The modules supplement introductory medical education. They are AI-assisted writing and have not received independent clinical/faculty review. They do not provide diagnosis, treatment recommendations, patient-specific interpretation, accreditation or exam-readiness claims. References are links for fact checking and further reading; textbook images and question banks are not republished. Update `STUDY_UPDATED` only when the study material changes.

Content lives in `app/lib/medical-study.ts`. Each question has a stable id, one answer index, three options and an explanation. English and Indonesian share ids so the learner's completion status survives a language change. Add future translations only after translating and checking all learning content, and then extend `studyLanguages`, page metadata and sitemap availability together.

## Progress and privacy

Only completed module ids are stored under `anatomy-medical-study-v1` in browser localStorage. A validated, stable snapshot is exposed through `useSyncExternalStore`; browser storage events synchronize tabs. Invalid or blocked storage must not crash learning. Answers and scores are session-only; no patient data, account or new backend is introduced. The reset control clears only this feature's module progress after confirmation.

## Support

`app/lib/support.ts` is the single source of public support destinations. PayPal uses the owner-supplied email with copy instructions; no unverified merchant checkout is advertised. Crypto addresses match the Oracle donation panel, but are restricted in the UI to each named native mainnet. No transfers or payment tests were performed. Contact is `anton@vijeron.com`. No charitable status, tax deduction, investment return or paid academic credential is claimed.

## Verification

Use `npm run lint`, `npx tsc --noEmit`, `npm run build`, and `npx tsx --test tests/*.test.mjs`. Browser verification should cover answering incorrectly and correctly, reset, card flip/navigation, completion persistence, language links, responsive layout, and copy controls. Deployment uses the existing `anatomy` Cloudflare Worker with its existing custom domain.
