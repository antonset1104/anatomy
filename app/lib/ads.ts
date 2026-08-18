/**
 * Ad placement configuration, read on the server.
 *
 * Deliberately not part of `AdSlot.tsx`: that file is a client module, and a
 * client module's exports cannot be called during a server render — the pages
 * read the env here and hand the values down as props.
 *
 * Nothing is hard-coded. With `NEXT_PUBLIC_ADSENSE_CLIENT` unset, every slot
 * renders `null`, `/ads.txt` returns 404, and no third-party script is loaded.
 * Set the publisher id and the slot ids to switch monetisation on:
 *
 *   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-0000000000000000
 *   NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE=0000000000
 *   NEXT_PUBLIC_ADSENSE_SLOT_LISTING=0000000000
 */
export type AdConfig = {
  client?: string;
  /** In-article placement, used mid-content on organ and system pages. */
  article?: string;
  /** Listing placement, used above the fold on the hub pages. */
  listing?: string;
};

export function adConfig(): AdConfig {
  return {
    client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
    article: process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE,
    listing: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LISTING,
  };
}
