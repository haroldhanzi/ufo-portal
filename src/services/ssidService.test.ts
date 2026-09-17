import { describe, expect, it } from "vitest";
import { normalizeSsidRows } from "./ssidService";
import type { SsidGroup } from "../types/omada";

describe("SSID list normalization", () => {
  it("discards duplicate gateway pseudo-WLAN records", () => {
    const ssid = { ssidId: "ssid-1", name: "Guest" };
    const groups = [
      { wlanId: "real-wlan-1", ssidList: [ssid] },
      { wlanId: "gateway", ssidList: [ssid] },
    ] as unknown as SsidGroup[];
    expect(normalizeSsidRows(groups)).toEqual([
      expect.objectContaining({ ssidId: "ssid-1", wlanId: "real-wlan-1" }),
    ]);
  });
});
