import assert from "node:assert/strict";
import test from "node:test";
import { adsTxt } from "../app/lib/static-files.ts";

test("ads.txt contains only explicitly configured seller records", () => {
  const previousExtra = process.env.ADS_TXT_EXTRA_RECORDS;
  try {
    delete process.env.ADS_TXT_EXTRA_RECORDS;
    assert.equal(adsTxt(), null);

    process.env.ADS_TXT_EXTRA_RECORDS = "example.com, publisher-123, DIRECT, abcdef0123456789";
    assert.equal(adsTxt(), "example.com, publisher-123, DIRECT, abcdef0123456789\n");
  } finally {
    if (previousExtra === undefined) delete process.env.ADS_TXT_EXTRA_RECORDS;
    else process.env.ADS_TXT_EXTRA_RECORDS = previousExtra;
  }
});
