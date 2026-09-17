export interface OmadaEnvelope<T> {
  errorCode: number;
  msg?: string;
  result: T;
}
export interface Ssid {
  ssidId: string;
  id?: string;
  wlanId?: string;
  name: string;
  ssidName?: string;
  band: number;
  security: number;
  guestNetEnable: boolean;
  broadcast: boolean;
  vlanEnable: boolean;
  vlanId?: number;
  pmfMode: number;
  enable11r: boolean;
  prohibitWifiShare: boolean;
  pskSetting?: {
    securityKey?: string;
    versionPsk: number;
    encryptionPsk: number;
    [key: string]: unknown;
  };
  wlanScheduleEnable?: boolean;
  scheduleId?: string;
  portalName?: string;
  [key: string]: unknown;
}
export interface SsidGroup {
  wlanId: string;
  ssidList: Ssid[];
}
export interface TimeRange {
  dayType: number;
  startTimeH: number;
  startTimeM: number;
  endTimeH: number;
  endTimeM: number;
}
export interface Schedule {
  profileId: string;
  name: string;
  dayMode: number;
  customDayMode?: Record<string, boolean>;
  timeList: TimeRange[];
}
export interface Portal {
  id: string;
  portalId?: string;
  name: string;
  enable: boolean;
  ssidList: string[];
  networkList: string[];
  authType: number;
  httpsRedirectEnable?: boolean;
  landingPage?: number;
  hotspot?: { enabledTypes: number[] };
  hotspotTypes?: number[];
  portalCustomize?: Record<string, unknown>;
  [key: string]: unknown;
}
export interface VoucherGroup {
  id: string;
  name: string;
  createTime?: number;
  creator?: string;
  limitType: number;
  limitNum?: number;
  durationType: number;
  duration: number;
  trafficLimitEnable: boolean;
  trafficLimit?: number;
  portals?: string[];
  validityType: number;
  used?: number;
  unused?: number;
  expired?: number;
}
export interface SimpleVoucher {
  id: string;
  code: string;
  status: number;
  trafficUsed: number;
  trafficUnused: number;
  trafficLimit: number;
  trafficLimitFrequency: number;
  downLimit: number;
  upLimit: number;
  startTime: number;
  timeUsedSec: number;
  timeLeftSec: number;
  timingByClientUsage: boolean;
}
export interface VoucherGroupDetail extends VoucherGroup {
  createdTime: number;
  creatorName: string;
  timingType: number;
  currency: string;
  portalNames: string[];
  unusedCount: number;
  usedCount: number;
  inUseCount: number;
  expiredCount: number;
  totalCount: number;
  totalRows: number;
  currentPage: number;
  currentSize: number;
  data: SimpleVoucher[];
}
export interface Voucher {
  id: string;
  code: string;
  createdTime: number;
  limitType: number;
  limitNum: number;
  used: number;
  durationType: number;
  duration: number;
  timingType: number;
  expirationTime: number;
  effectiveTime: number;
  description: string;
  trafficLimitEnable: boolean;
  trafficLimit: number;
  trafficLimitFrequency: number;
  trafficLeft: boolean;
  startTime: number;
  endTime: number;
  valid: boolean;
  trafficUsed: number;
  unitPrice: string;
  currency: string;
  portalNames: string[];
  logout: boolean;
  validity: string;
  ssidNameList: string[];
  networkNameList: string[];
  rateLimit?: {
    mode: number;
    rateLimitProfileId?: string;
    customRateLimit?: {
      downLimitEnable: boolean;
      downLimit: number;
      upLimitEnable: boolean;
      upLimit: number;
    };
  };
}
export interface WifiForm {
  name: string;
  password: string;
  bands: number[];
  guestNetEnable: boolean;
  broadcast: boolean;
  security: number;
  versionPsk: number;
  encryptionPsk: number;
  pmfMode: number;
  enable11r: boolean;
  prohibitWifiShare: boolean;
  vlanEnable: boolean;
  vlanId?: number;
}
export interface ScheduleForm {
  name: string;
  dayMode: number;
  days: number[];
  startTime: string;
  endTime: string;
}
export interface PortalForm {
  name: string;
  enable: boolean;
  ssidList: string[];
  authType: number;
  hotspotType: number;
  landingPage: number;
  httpsRedirectEnable: boolean;
}
export interface VoucherForm {
  name: string;
  amount: number;
  codeLength: number;
  codeForm: number[];
  limitType: number;
  limitNum: number;
  durationType: number;
  duration: number;
  timingType: number;
  trafficLimitEnable: boolean;
  trafficLimit: number;
  trafficLimitFrequency: number;
  unitPrice: number;
  currency: string;
  portalId: string;
  validityType: number;
  effectiveTime?: string;
  expirationTime?: string;
  description: string;
}
