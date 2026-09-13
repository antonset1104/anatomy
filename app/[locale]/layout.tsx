import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getLocale, isLocale, localeCodes } from "../i18n/config";
import { fontClassName } from "../i18n/fonts";
import { siteUrl } from "../lib/seo";
import { adConfig } from "../lib/ads";
import "../globals.css";

export function generateStaticParams() {
  return localeCodes.map((locale) => ({ locale }));
}

/**
 * Paints the stored theme before the first frame. Without this the page renders
 * light, then flips once React hydrates and reads localStorage — a flash that is
 * far more jarring in a dark room than the inline script costs.
 */
const THEME_BOOTSTRAP = `
try {
  var saved = JSON.parse(localStorage.getItem("anatomy-atelier:v2") || "{}");
  var prefs = saved.prefs || {};
  var theme = prefs.theme === "light" || prefs.theme === "dark"
    ? prefs.theme
    : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.text = prefs.textSize || "md";
  root.dataset.motion = prefs.reduceMotion ? "reduced" : "full";
} catch (error) {}
`;

/**
 * Only the shell-level tags live here. Titles, descriptions, canonicals, and
 * hreflang belong to each page — a canonical inherited from the layout would
 * point every article at the studio.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Anatomy Atelier",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1016" },
  ],
  colorScheme: "light dark",
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const config = getLocale(locale);
  const ads = adConfig();

  return (
    <html lang={config.code} dir={config.dir} suppressHydrationWarning>
      <head>
        {/* Google Funding Choices (CMP) - EU User Consent Policy Compliance */}
        <script
          async
          src="https://fundingchoicesmessages.google.com/i/pub-6180580801533680?ers=1"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){var iframe=document.createElement('iframe');iframe.style.cssText='width:0;height:0;border:none;';iframe.style.display='none';iframe.name='googlefcPresent';document.body.appendChild(iframe);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();`,
          }}
        />
        {/* Google tag (gtag.js) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-79X7K7H4MJ"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-79X7K7H4MJ');
`,
          }}
        />
        {/*
          Publisher id dibaca dari env, bukan ditulis langsung.

          Sebelumnya id ini di-hardcode di sini, sementara app/lib/ads.ts dan
          app/lib/static-files.ts sama-sama membaca NEXT_PUBLIC_ADSENSE_CLIENT —
          sehingga pada build tanpa env, skrip AdSense tetap dimuat di setiap
          halaman padahal /ads.txt mengembalikan 404 dan seluruh slot iklan
          merender null. Bagi Google itu berarti sebuah situs memuat pustaka
          publisher tanpa satu pun authorized-seller record yang bisa
          diverifikasi. Dengan perubahan ini, skrip dan ads.txt selalu muncul
          atau tidak muncul bersama-sama.
        */}
        {ads.client ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ads.client)}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className={fontClassName(config.script)}>{children}</body>
    </html>
  );
}
