import assert from "node:assert/strict";
import test from "node:test";
import { adsTxt } from "../app/lib/static-files.ts";

test("ads.txt supports a non-AdSense seller without loading AdSense", () => {
  const previousClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const previousExtra = process.env.ADS_TXT_EXTRA_RECORDS;
  try {
    delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    delete process.env.ADS_TXT_EXTRA_RECORDS;
    assert.equal(adsTxt(), null);

    process.env.ADS_TXT_EXTRA_RECORDS = "example.com, publisher-123, DIRECT, abcdef0123456789";
    assert.equal(adsTxt(), "example.com, publisher-123, DIRECT, abcdef0123456789\n");
  } finally {
    if (previousClient === undefined) delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
    else process.env.NEXT_PUBLIC_ADSENSE_CLIENT = previousClient;
    if (previousExtra === undefined) delete process.env.ADS_TXT_EXTRA_RECORDS;
    else process.env.ADS_TXT_EXTRA_RECORDS = previousExtra;
  }
});
