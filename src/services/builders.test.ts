import { describe, expect, it } from "vitest";
import {
  buildCreatePortalRequest,
  buildCreateScheduleRequest,
  buildCreateSsidRequest,
  buildCreateVoucherRequest,
  buildPasswordUpdate,
  buildPortalUpdate,
} from "./builders";
import type { Portal, Ssid } from "../types/omada";

describe("Omada request builders", () => {
  it("matches the known-good static password update payload", () => {
    const current = {
      id: "ssid-1",
      ssidId: "ssid-1",
      wlanId: "wlan-1",
      name: "Guest",
      band: 3,
      security: 3,
      guestNetEnable: true,
      broadcast: true,
      vlanEnable: false,
      pmfMode: 3,
      enable11r: false,
      prohibitWifiShare: false,
      autoWanAccess: false,
      mloEnable: false,
      enhancedIotConnectivity: false,
      pskSetting: {
        securityKey: "old-pass-1",
        versionPsk: 2,
        encryptionPsk: 3,
      },
      clientRateLimit: { profileId: "read-only" },
      wlanSchedule: { wlanScheduleEnable: false },
    } as unknown as Ssid;
    const result = buildPasswordUpdate(current, "new-pass-1");
    expect(result).toEqual({
      name: "Guest",
      band: 3,
      autoWanAccess: true,
      guestNetEnable: true,
      security: 3,
      oweEnable: false,
      broadcast: true,
      vlanEnable: false,
      pskSetting: {
        securityKey: "new-pass-1",
        versionPsk: 2,
        encryptionPsk: 3,
        gikRekeyPskEnable: false,
        rekeyPskInterval: 0,
        intervalPskType: 0,
      },
      mloEnable: false,
      pmfMode: 3,
      enable11r: true,
      hidePwd: true,
      greEnable: false,
      prohibitWifiShare: true,
      enhancedIotConnectivity: false,
    });
  });

  it("omits disabled SSID feature payloads", () => {
    const result = buildCreateSsidRequest({
      name: "Guest",
      password: "password1",
      bands: [1, 2],
      guestNetEnable: true,
      broadcast: true,
      security: 3,
      versionPsk: 2,
      encryptionPsk: 3,
      pmfMode: 3,
      enable11r: false,
      prohibitWifiShare: true,
      vlanEnable: false,
    });
    expect(result.band).toBe(3);
    expect(result).not.toHaveProperty("vlanId");
    expect(result).not.toHaveProperty("vlanSetting");
  });

  it("maps custom schedule days into time ranges", () => {
    const result = buildCreateScheduleRequest({
      name: "Test",
      dayMode: 3,
      days: [1, 5],
      startTime: "08:15",
      endTime: "17:45",
    });
    expect(result.timeList).toEqual([
      { dayType: 1, startTimeH: 8, startTimeM: 15, endTimeH: 17, endTimeM: 45 },
      { dayType: 5, startTimeH: 8, startTimeM: 15, endTimeH: 17, endTimeM: 45 },
    ]);
  });

  it("includes only the selected portal authentication object", () => {
    const result = buildCreatePortalRequest({
      name: "Voucher",
      enable: true,
      ssidList: ["ssid-1"],
      authType: 11,
      hotspotType: 3,
      landingPage: 1,
      httpsRedirectEnable: true,
    });
    expect(result).toHaveProperty("hotspot.enabledTypes", [3]);
    expect(result).not.toHaveProperty("simplePassword");
    expect(result).not.toHaveProperty("externalRadius");
  });

  it("supplies required defaults when updating a portal list record", () => {
    const result = buildPortalUpdate(
      {
        id: "portal-1",
        name: "Partner Portal",
        enable: true,
        ssidList: ["ssid-1"],
        networkList: [],
        authType: 11,
        hotspotTypes: [3],
      } as Portal,
      ["ssid-1", "ssid-2"],
    );
    expect(result).toMatchObject({
      ssidList: ["ssid-1", "ssid-2"],
      httpsRedirectEnable: true,
      landingPage: 1,
      hotspot: { enabledTypes: [3] },
      portalCustomize: {
        defaultLanguage: 1,
        logoDisplay: true,
      },
    });
  });

  it("omits disabled voucher limits and converts validity dates", () => {
    const result = buildCreateVoucherRequest({
      name: "Group",
      amount: 10,
      codeLength: 8,
      codeForm: [0, 1],
      limitType: 2,
      limitNum: 1,
      durationType: 0,
      duration: 60,
      timingType: 0,
      trafficLimitEnable: false,
      trafficLimit: 0,
      trafficLimitFrequency: 0,
      unitPrice: 1,
      currency: "USD",
      portalId: "portal-1",
      validityType: 1,
      effectiveTime: "2026-01-01T00:00",
      expirationTime: "2026-01-02T00:00",
      description: "Test",
    });
    expect(result).not.toHaveProperty("limitNum");
    expect(result).not.toHaveProperty("trafficLimit");
    expect(typeof result.effectiveTime).toBe("number");
    expect(typeof result.expirationTime).toBe("number");
  });
});
