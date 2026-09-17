import type {
  Portal,
  PortalForm,
  ScheduleForm,
  Ssid,
  VoucherForm,
  WifiForm,
} from "../types/omada";
const time = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return [h, m];
};
export function buildCreateSsidRequest(f: WifiForm) {
  const band = f.bands.reduce((a, b) => a | b, 0);
  const request: Record<string, unknown> = {
    name: f.name,
    deviceType: 3,
    ssidEnable: true,
    chooseDevices: 0,
    apGroupIds: [],
    band,
    guestNetEnable: f.guestNetEnable,
    security: f.security,
    broadcast: f.broadcast,
    vlanEnable: f.vlanEnable,
    mloEnable: false,
    pmfMode: f.pmfMode,
    enable11r: f.enable11r,
    hidePwd: true,
    greEnable: false,
    prohibitWifiShare: f.prohibitWifiShare,
    wifiCallingEnable: false,
    enhancedIotConnectivity: false,
  };
  if (f.vlanEnable) request.vlanId = f.vlanId;
  if (f.security === 3)
    request.pskSetting = {
      securityKey: f.password,
      versionPsk: f.versionPsk,
      encryptionPsk: f.encryptionPsk,
      gikRekeyPskEnable: false,
      rekeyPskInterval: 0,
      intervalPskType: 0,
    };
  return request;
}
export function buildPasswordUpdate(current: Ssid, password: string) {
  return {
    name: current.name,
    band: 3,
    autoWanAccess: true,
    guestNetEnable: true,
    security: 3,
    oweEnable: false,
    broadcast: true,
    vlanEnable: false,
    pskSetting: {
      securityKey: password,
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
  };
}
export function buildCreateScheduleRequest(f: ScheduleForm) {
  const [sh, sm] = time(f.startTime),
    [eh, em] = time(f.endTime);
  const days = f.dayMode === 3 ? f.days : [0];
  return {
    name: f.name,
    dayMode: f.dayMode,
    ...(f.dayMode === 3
      ? {
          customDayMode: Object.fromEntries(
            [
              "dayMon",
              "dayTue",
              "dayWed",
              "dayThu",
              "dayFri",
              "daySat",
              "daySun",
            ].map((k, i) => [k, f.days.includes(i + 1)]),
          ),
        }
      : {}),
    timeList: days.map((dayType) => ({
      dayType,
      startTimeH: sh,
      startTimeM: sm,
      endTimeH: eh,
      endTimeM: em,
    })),
  };
}
export function buildCreatePortalRequest(f: PortalForm) {
  return {
    name: f.name,
    enable: f.enable,
    ssidList: f.ssidList,
    networkList: [],
    authType: f.authType,
    authTimeout: { customTimeout: 1, customTimeoutUnit: 3 },
    httpsRedirectEnable: f.httpsRedirectEnable,
    landingPage: f.landingPage,
    ...(f.authType === 11
      ? { hotspot: { enabledTypes: [f.hotspotType] } }
      : {}),
    pageType: 1,
    portalCustomize: {
      defaultLanguage: 1,
      logoDisplay: true,
      welcomeEnable: false,
      termsOfServiceEnable: false,
      copyrightEnable: false,
    },
  };
}
export function buildPortalUpdate(current: Portal, ssidList: string[]) {
  const authType = current.authType ?? 11;
  return {
    name: current.name,
    enable: current.enable,
    ssidList,
    networkList: current.networkList ?? [],
    authType,
    authTimeout: current.authTimeout ?? {
      customTimeout: 1,
      customTimeoutUnit: 3,
    },
    httpsRedirectEnable: current.httpsRedirectEnable ?? true,
    landingPage: current.landingPage ?? 1,
    ...(authType === 11
      ? {
          hotspot: {
            enabledTypes: current.hotspot?.enabledTypes ??
              current.hotspotTypes ?? [3],
          },
        }
      : {}),
    pageType: current.pageType ?? 1,
    portalCustomize: current.portalCustomize ?? {
      defaultLanguage: 1,
      logoDisplay: true,
      welcomeEnable: false,
      termsOfServiceEnable: false,
      copyrightEnable: false,
    },
  };
}
export function buildCreateVoucherRequest(f: VoucherForm) {
  return {
    name: f.name,
    amount: f.amount,
    codeLength: f.codeLength,
    codeForm: f.codeForm,
    limitType: f.limitType,
    ...(f.limitType !== 2 ? { limitNum: f.limitNum } : {}),
    durationType: f.durationType,
    duration: f.duration,
    timingType: f.timingType,
    rateLimit: {
      mode: 0,
      rateLimitProfileId: "",
      customRateLimit: {
        downLimitEnable: false,
        downLimit: 0,
        upLimitEnable: false,
        upLimit: 0,
      },
    },
    trafficLimitEnable: f.trafficLimitEnable,
    ...(f.trafficLimitEnable
      ? {
          trafficLimit: f.trafficLimit,
          trafficLimitFrequency: f.trafficLimitFrequency,
        }
      : {}),
    unitPrice: f.unitPrice,
    currency: f.currency,
    applyToAllPortals: false,
    portals: [f.portalId],
    ...(f.validityType === 1
      ? {
          effectiveTime: new Date(f.effectiveTime!).getTime(),
          expirationTime: new Date(f.expirationTime!).getTime(),
        }
      : {}),
    logout: true,
    description: f.description,
    printComments: "",
    validityType: f.validityType,
    ...(f.validityType === 2
      ? {
          schedule: {
            type: 0,
            dailyStartHour: 0,
            dailyStartMin: 0,
            dailyEndHour: 23,
            dailyEndMin: 59,
            weeklyEnableDays: [],
          },
        }
      : {}),
  };
}
