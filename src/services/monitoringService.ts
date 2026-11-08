import { backend, type BackendPage } from "./backendClient";
export type DeviceState = "UNKNOWN" | "CONNECTED" | "DISCONNECTED";
export interface MonitoredDevice {
  id: number;
  siteId: string;
  mac: string;
  deviceNumber: string;
  name: string;
  location: string;
  previousState: DeviceState;
  currentState: DeviceState;
  lastStatusChange: string;
  lastObserved?: string;
  alertRecipients?: Recipient[];
  escalationRecipients?: Recipient[];
  escalationHours?: number[];
}
export type DeviceInput = Pick<
  MonitoredDevice,
  "siteId" | "mac" | "deviceNumber" | "name" | "location"
>;
export interface Recipient {
  name: string;
  email: string | null;
  mobile: string | null;
}
export interface AlertRuleInput {
  kind: "NOTIFICATION" | "ESCALATION";
  method: "EMAIL" | "SMS" | "BOTH";
  triggerType: "STATE" | "STATE_CHANGE" | "PERIOD_IN_STATE";
  targetState: DeviceState;
  minimumSeconds: number;
  repeatSeconds: number;
  maximumCount: number;
  startTime: string;
  endTime: string;
  zoneId: string;
  overrideMac: string | null;
  recipients: Recipient[];
}
export interface AlertRule extends Omit<AlertRuleInput, "recipients"> {
  id: number;
  recipientsJson: string;
}
export interface StatusChange {
  id: number;
  previousState: DeviceState;
  currentState: DeviceState;
  changedAt: string;
}
export interface Notification {
  id: number;
  kind: string;
  message: string;
  createdAt: string;
  deliveryState: string;
  method: string;
  attemptCount: number;
}
export const listDevices = (siteId: string, page: number) =>
  backend
    .get<
      BackendPage<MonitoredDevice>
    >("/monitoring/devices", { params: { siteId, page, size: 25 } })
    .then((r) => r.data);
export const createDevice = (input: DeviceInput) =>
  backend.post("/monitoring/devices", input);
export const updateDevice = (id: number, input: DeviceInput) =>
  backend.put(`/monitoring/devices/${id}`, input);
export const rebootDevice = (id: number) =>
  backend.post(`/monitoring/devices/${id}/reboot`);
export const deviceHistory = (id: number, page = 0) =>
  backend
    .get<
      BackendPage<StatusChange>
    >(`/monitoring/devices/${id}/history`, { params: { page, size: 25 } })
    .then((r) => r.data);
export const deviceNotifications = (id: number, page = 0) =>
  backend
    .get<
      BackendPage<Notification>
    >(`/monitoring/devices/${id}/notifications`, { params: { page, size: 25 } })
    .then((r) => r.data);
export const deviceRules = (id: number) =>
  backend
    .get<AlertRule[]>(`/monitoring/devices/${id}/rules`)
    .then((r) => r.data);
export const addDeviceRule = (id: number, rule: AlertRuleInput) =>
  backend.post(`/monitoring/devices/${id}/rules`, rule);
export const disableDeviceRule = (id: number, ruleId: number) =>
  backend.delete(`/monitoring/devices/${id}/rules/${ruleId}`);
