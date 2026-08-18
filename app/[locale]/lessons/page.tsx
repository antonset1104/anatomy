import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getLocale, isLocale, localeCodes } from "../../i18n/config";
import { getDictionary } from "../../i18n/dictionaries";
import { buildOrgans } from "../../i18n/merge";
import { format } from "../../i18n/types";
import { buildLessons } from "../../lib/lessons";
import { routes, studioLink } from "../../lib/routes";
import { breadcrumbGraph, learningResourceGraph, pageMetadata } from "../../lib/seo";
import { Breadcrumbs, SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { StructuredData } from "../../components/StructuredData";
import { AdSlot } from "../../components/AdSlot";
import { adConfig } from "../../lib/ads";

type Params = { locale: string };

export function generateStaticParams() {
  return localeCodes.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { ui } = await getDictionary(locale);
  return pageMetadata({
    locale: getLocale(locale),
    path: "/lessons",
    title: ui.pages.lessonsTitle,
    description: ui.pages.lessonsDescription,
  });
}

export default async function LessonsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const { ui: t, organs: content } = await getDictionary(locale);
  const organs = buildOrgans(content, t);
  const lessons = buildLessons(organs);
  const ads = adConfig();

  const trail = [
    { name: t.site.home, path: routes.studio(locale) },
    { name: t.pages.lessonsTitle },
  ];

  return (
    <>
      <StructuredData
        graphs={[
          breadcrumbGraph([
            { name: t.site.home, path: routes.studio(locale) },
            { name: t.pages.lessonsTitle, path: routes.lessons(locale) },
          ]),
          learningResourceGraph({
            locale: config,
            path: routes.lessons(locale),
            name: t.pages.lessonsTitle,
            description: t.pages.lessonsDescription,
            lessons: lessons.map((lesson) => ({
              name: lesson.title,
              steps: lesson.steps.length,
              path: lesson.organId ? studioLink(locale, lesson.organId) : routes.lessons(locale),
            })),
          }),
        ]}
      />

      <SiteHeader locale={config} t={t} />

      <main className="content-page">
        <Breadcrumbs t={t} trail={trail} />

        <header className="page-head">
          <h1>{t.pages.lessonsTitle}</h1>
          <p>{t.pages.lessonsDescription}</p>
        </header>

        <AdSlot client={ads.client} slot={ads.listing} format="leaderboard" label={t.ads.label} />

        <div className="hub-grid">
          {lessons.map((lesson) => {
            const organ = organs.find((item) => item.id === lesson.organId);
            if (!organ) return null;
            return (
              <article key={lesson.id} className="hub-card" style={{ "--chip-accent": organ.accent } as React.CSSProperties}>
                <h2>
                  <Link href={studioLink(locale, organ.id)}>{lesson.title}</Link>
                </h2>
                <p>{lesson.subtitle}</p>
                <p className="hub-meta">{format(t.lessons.duration, { count: lesson.steps.length })}</p>
                {/* The first three steps in plain text: enough for a crawler to
                    see what the lesson teaches without opening the studio. */}
                <ul className="hub-links">
                  {lesson.steps.slice(0, 3).map((step) => (
                    <li key={step.hotspotId}>
                      <Link href={studioLink(locale, organ.id, step.hotspotId)}>
                        {step.label} <ArrowRight size={12} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={routes.organ(locale, organ.id)} className="text-link">
                  {organ.name} <ArrowRight size={13} />
                </Link>
              </article>
            );
          })}
        </div>
      </main>

      <SiteFooter
        locale={config}
        t={t}
        organLinks={organs.map((item) => ({ name: item.name, href: routes.organ(locale, item.id) }))}
      />
    </>
  );
}
