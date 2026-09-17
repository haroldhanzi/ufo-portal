You are working on an existing web application for the UFO Internet Service Provider Partner Portal.

Your task is to build a functional, clickable management interface that integrates with the TP-Link Omada Northbound APIs already identified for:

1. WiFi / SSID management
2. WiFi schedule creation and retrieval
3. Portal management
4. Voucher management

Do not build static mockups. Build real forms, tables, dialogs, dropdowns, validation, API service calls, loading states, success/error handling, and navigation.

TECH STACK

Use:
- React
- TypeScript
- Material UI
- Axios
- React Router
- React Hook Form where appropriate
- Keep API access in reusable service modules
- Do not scatter raw Axios calls directly inside UI components

Use a clean enterprise ISP/admin portal design.

==================================================
1. APPLICATION STRUCTURE
==================================================

Create these main sections in the left navigation:

- Dashboard
- WiFi Networks
- Schedules
- Portals
- Vouchers
- Clients
- Users

For now, fully implement:

- WiFi Networks
- Schedules
- Portals
- Vouchers

Clients and Users can remain placeholder pages if their APIs are not yet available.

The active location/site should be visible in the page header, for example:

Location XYZ

The Omada controller/site information should come from configuration/environment variables, not be hard-coded throughout the application.

Use environment variables such as:

VITE_OMADA_BASE_URL=https://euw1-omada-northbound.tplinkcloud.com
VITE_OMADA_ID=caaaa331cf6e876e8fea7403e00e7ff6
VITE_OMADA_SITE_ID=6a4eb57c543849228eba7341

Do not hard-code an AccessToken in source code.

For development, support storing the AccessToken in an app config/session mechanism.

Authorization header format:

Authorization: AccessToken=<token>

==================================================
2. API SERVICE LAYER
==================================================

Create reusable services such as:

src/services/
  omadaClient.ts
  ssidService.ts
  scheduleService.ts
  portalService.ts
  voucherService.ts

The common Axios client should handle:

- base URL
- Authorization header
- content-type application/json
- Omada response errorCode handling
- HTTP error handling

Omada often returns HTTP success while the payload contains:

{
  "errorCode": -1001,
  "msg": "..."
}

Therefore treat:

errorCode !== 0

as an application/API failure and surface `msg` to the user.

==================================================
3. WIFI / SSID MANAGEMENT
==================================================

Implement a WiFi Networks page.

Heading:

Location XYZ - WiFi Management

Actions:

- Add New WiFi Network
- Refresh

Table columns:

- WiFi Name
- Bands
- Security
- Guest Network
- Schedule
- Portal
- Actions

Actions per row:

- View
- Change Password
- Manage Schedule
- Delete

==================================================
4. GET SSID LIST
==================================================

API:

GET
/openapi/v1/{omadacId}/sites/{siteId}/wireless-network/ssids?type=3

Use this endpoint to populate the WiFi table.

SSID detail requires:

GET
/openapi/v1/{omadacId}/sites/{siteId}/wireless-network/wlans/{wlanId}/ssids/{ssidId}

Use SSID detail before editing an existing SSID.

This is important because update operations should preserve the existing configuration and only change the fields the user actually edited.

==================================================
5. CREATE WIFI NETWORK
==================================================

API:

POST
/openapi/v2/{omadacId}/sites/{siteId}/wireless-network/ssids

Build a modal or full-page form called:

Create WiFi Network

Do NOT expose numeric Omada enums directly to the user.

Use human-readable dropdowns/toggles.

Fields:

SSID Name
Password
Bands
Guest Network
Broadcast SSID
Security
PMF
802.11r
Prohibit WiFi Sharing
VLAN Enabled

Band dropdown / checkbox mapping:

1 = 2.4 GHz
2 = 5 GHz
4 = 6 GHz

Combined bitmasks:

1 = 2.4 GHz
2 = 5 GHz
3 = 2.4 + 5 GHz
4 = 6 GHz
5 = 2.4 + 6 GHz
6 = 5 + 6 GHz
7 = 2.4 + 5 + 6 GHz

Prefer multi-select checkboxes in UI and calculate the bitmask internally.

Security dropdown:

0 = None
2 = WPA Enterprise
3 = WPA Personal
4 = PPSK without RADIUS
5 = PPSK with RADIUS

For the current UFO Partner use case, WPA Personal is the default.

WPA Personal version dropdown:

1 = WPA-PSK
2 = WPA2-PSK
3 = WPA/WPA2-PSK
4 = WPA2-PSK/WPA3-SAE

Encryption dropdown:

1 = Auto
3 = AES

PMF dropdown:

1 = Mandatory
2 = Capable
3 = Disable

Do not send invalid placeholder values such as:

pmfMode: 0
vlanId: 0
bridgeVlan: 0

When a feature is disabled and its dependent values are not required, omit those properties from the request instead of sending empty strings or zero values.

For example:

If VLAN Enabled = false:

send:

"vlanEnable": false

Do NOT send:

"vlanId": 0

and do not send a meaningless vlanSetting/customConfig object.

If VLAN Enabled = true:

show VLAN ID field.

Validation:

VLAN ID:
1 to 4094

Password:
8-63 printable ASCII characters for WPA Personal

SSID name:
1-32 UTF-8 characters

If 6 GHz is selected:
enforce appropriate WPA3-compatible settings.
Do not allow an invalid combination such as:

band = 7
versionPsk = 1

==================================================
6. CHANGE WIFI PASSWORD
==================================================

API:

PATCH
/openapi/v1/{omadacId}/sites/{siteId}/wireless-network/ssids/{ssidId}/basic-config

Do not create a huge default update payload.

Flow:

1. GET SSID detail
2. populate current configuration
3. user enters new password
4. preserve existing SSID values
5. update only pskSetting.securityKey
6. send valid current configuration back

Create a modal:

Change WiFi Password

Fields:

- SSID Name read-only
- New Password
- Confirm Password

Validate:
- minimum 8
- maximum 63
- both passwords must match

==================================================
7. DELETE WIFI
==================================================

API:

DELETE
/openapi/v1/{omadacId}/sites/{siteId}/wireless-network/ssids/{ssidId}

Require confirmation dialog.

Example:

Delete "UFO WIFI"?

This action cannot be undone.

==================================================
8. SCHEDULE MANAGEMENT
==================================================

Build a dedicated page:

Location XYZ - Schedule Management

Purpose:

Create and retrieve reusable Omada Time Range Profiles.

API to retrieve schedules:

GET
/openapi/v1/{omadacId}/sites/{siteId}/time-range-profiles

Response contains:

profileId
name
dayMode
customDayMode
timeList

Display schedules in a table:

- Schedule Name
- Days
- Time
- Profile ID
- Actions

==================================================
9. CREATE SCHEDULE
==================================================

API:

POST
/openapi/v1/{omadacId}/sites/{siteId}/time-range-profiles

Form:

Schedule Name

Day Mode dropdown:

0 = Every Day
1 = Weekday
2 = Weekend
3 = Customized

Do NOT display the numeric values to the user.

Display:

Every Day
Weekdays
Weekends
Custom Days

Internally send the correct number.

If Day Mode = Every Day:

do not show day checkboxes.

If Day Mode = Weekday:

represent Monday-Friday.

If Day Mode = Weekend:

represent Saturday-Sunday.

If Day Mode = Customized:

show checkboxes:

Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday

Map them internally to:

dayMon
dayTue
dayWed
dayThu
dayFri
daySat
daySun

Time fields:

Start Time
End Time

The API only supports minutes:

00
15
30
45

Therefore use time dropdowns or controlled time inputs that restrict minutes to:

00
15
30
45

Do not allow unsupported minutes such as:

08:10

For dayMode 0, 1 or 2:

dayType must be 0.

For dayMode 3:

dayType mapping is:

1 = Monday
2 = Tuesday
3 = Wednesday
4 = Thursday
5 = Friday
6 = Saturday
7 = Sunday

Create appropriate timeList entries.

Example Weekday schedule:

{
  "name": "Business Hours",
  "dayMode": 1,
  "timeList": [
    {
      "dayType": 0,
      "startTimeH": 6,
      "startTimeM": 0,
      "endTimeH": 22,
      "endTimeM": 0
    }
  ]
}

For Customized schedules, create one timeList entry per selected day when necessary.

Important validation:

- Schedule name: 1-64 characters
- end time must be later than start time
- timeList cannot be empty
- minutes must be one of 0,15,30,45

Known Omada errors include:

-33709 = profile already exists
-33716 = end time must be later than start time
-33723 = profile limit reached
-33731 = time range may not be empty
-33748 = too many time ranges
-33799 = invalid schedule parameters

Show user-friendly messages for these.

==================================================
10. ASSIGN SCHEDULE TO WIFI
==================================================

API:

PATCH
/openapi/v1/{omadacId}/sites/{siteId}/wireless-network/ssids/{ssidId}/wlan-schedule

Payload:

{
  "wlanScheduleEnable": true,
  "action": 1,
  "scheduleId": "<profileId>"
}

Important:

scheduleId = profileId returned by GET time-range-profiles.

Action mapping:

0 = WiFi OFF during selected schedule
1 = WiFi ON during selected schedule

UI:

Create a dialog called:

Manage WiFi Schedule

Fields:

Enable Schedule:
toggle

Schedule:
dropdown populated from GET /time-range-profiles

Action:
dropdown:

WiFi ON during selected period
WiFi OFF during selected period

Internally map to:

1 = ON
0 = OFF

Never show raw numeric values in the UI.

==================================================
11. PORTAL MANAGEMENT
==================================================

Create:

Location XYZ - Portal Management

Table:

- Portal Name
- Enabled
- Authentication Type
- Associated WiFi Networks
- Actions

Actions:

- View
- Add/Remove WiFi
- Edit
- Delete

Get portal list:

GET
/openapi/v1/{omadacId}/sites/{siteId}/portals

Portal response authentication mapping:

0 = No Authentication
1 = Simple Password
2 = External Radius
4 = External Portal Server
11 = Hotspot
15 = LDAP
16 = Social Login

For UFO Partner Portal, the main expected configuration is:

authType = 11

Hotspot authentication option mapping:

3 = Voucher
5 = Local User
6 = SMS
8 = Hotspot Radius
12 = Form Authentication

Default for this project:

Voucher

internally:

hotspot.enabledTypes = [3]

==================================================
12. CREATE PORTAL
==================================================

API:

POST
/openapi/v1/{omadacId}/sites/{siteId}/portal

Build a form with:

Portal Name
Enabled
Associated WiFi Networks
Authentication Type
Landing Page
HTTPS Redirect
Portal Appearance

Associated WiFi should be a multi-select populated from the SSID list API.

For UFO voucher portals:

Authentication Type:
Hotspot

Hotspot Type:
Voucher

Important API behavior:

Do NOT send unused configuration objects with invalid defaults.

Do not send empty objects such as:

simplePassword
sms
google
externalPortal
externalRadius
ldap
hotspotRadius

unless that authentication mechanism is selected.

Portal API validates nested objects whenever they are present.

portalCustomize is required by the current Omada deployment.

Use a minimal valid portalCustomize payload.

Example:

"portalCustomize": {
  "defaultLanguage": 1,
  "logoDisplay": true,
  "welcomeEnable": false,
  "termsOfServiceEnable": false,
  "copyrightEnable": false
}

Default language mapping should include at least:

1 = English

Never send invalid style placeholders such as:

welcomeTextFontSize: 0
buttonColor: ""
inputBoxColor: ""

Only include style properties when a real valid value exists.

==================================================
13. MODIFY PORTAL
==================================================

API:

PATCH
/openapi/v1/{omadacId}/sites/{siteId}/portal/{portalId}

Use this for:

- add WiFi
- remove WiFi
- update portal configuration
- update portal appearance

For adding/removing SSIDs:

read current portal
modify ssidList
send valid portal state back

Do not blindly create a large default payload.

==================================================
14. DELETE PORTAL
==================================================

API:

DELETE
/openapi/v1/{omadacId}/sites/{siteId}/portal/{portalId}

Use confirmation dialog.

==================================================
15. VOUCHER MANAGEMENT
==================================================

Create:

Location XYZ - Voucher Management

Get Voucher Groups:

GET
/openapi/v1/{omadacId}/sites/{siteId}/hotspot/voucher-groups?page=1&pageSize=10

Support query inputs for:

page
pageSize
searchKey

Display table:

- Group Name
- Created
- Creator
- Usage Type
- Duration
- Traffic Limit
- Portal
- Validity
- Used
- Unused
- Expired
- Actions

==================================================
16. CREATE VOUCHER GROUP
==================================================

API:

POST
/openapi/v1/{omadacId}/sites/{siteId}/hotspot/voucher-groups

Build a user-friendly form.

Fields:

Voucher Group Name
Number of Vouchers
Code Length
Code Character Type
Usage Limit
Duration
Timing Type
Traffic Limit
Traffic Limit Frequency
Price
Currency
Portal
Validity
Description

Dropdown mappings:

Code Form:

0 = Numbers
1 = Letters

Allow:
Numbers only
Letters only
Numbers + Letters

Limit Type:

0 = Limited Usage Counts
1 = Limited Online Users
2 = Unlimited

Duration Type:

0 = Client Duration
1 = Voucher Duration

Timing Type:

0 = Timing by Time
1 = Timing by Usage

Traffic Limit Frequency:

0 = Total
1 = Daily
2 = Weekly
3 = Monthly

Validity Type:

0 = Anytime
1 = Effective Date to Expiration Date
2 = Scheduled

If validityType = 1:

show:

Effective Date/Time
Expiration Date/Time

Convert selected dates to Unix timestamp milliseconds before calling the API.

If validityType = 2:

show schedule configuration.

Voucher code length:

6-10

Voucher amount:

1-5000

Traffic Limit:
API expects MB.

Duration:
API expects minutes.

Portal selection should be populated from:

GET /portals

and send portal IDs, not portal names.

==================================================
17. USER EXPERIENCE
==================================================

All enum values must display as labels, not raw numeric values.

Bad:

Day Mode: 3

Good:

Day Mode: Custom Days

Bad:

Security: 3

Good:

Security: WPA Personal

Use:

- Material UI Select
- Autocomplete
- Switch
- Checkbox
- TimePicker or restricted Select
- DateTimePicker where appropriate
- Dialogs
- Snackbar alerts
- CircularProgress
- Skeleton loading

Display API errors clearly.

For example:

Unable to create schedule

End time must be later than start time.

Do not dump raw JSON error blobs to normal users, but allow an expandable "Technical Details" section.

==================================================
18. UI DESIGN
==================================================

Use a professional ISP admin-console design.

Left sidebar:
dark navy

Main background:
very light gray

Primary accent:
blue / cyan

Cards:
white with subtle borders/shadows

Tables:
Material UI DataGrid or clean MUI tables

Do not make it look like an AI-generated generic dashboard.

Avoid:
- unnecessary gradients
- giant rounded cards everywhere
- excessive icons
- decorative charts not supported by real data

Prioritize:
- operational clarity
- tables
- forms
- dialogs
- status chips
- clear hierarchy

==================================================
19. COMPONENT STRUCTURE
==================================================

Prefer components such as:

src/
  components/
    common/
      ConfirmDialog.tsx
      PageHeader.tsx
      ApiErrorAlert.tsx
      LoadingOverlay.tsx

    wifi/
      WifiTable.tsx
      CreateWifiDialog.tsx
      ChangePasswordDialog.tsx
      WifiScheduleDialog.tsx

    schedules/
      ScheduleTable.tsx
      CreateScheduleDialog.tsx
      ScheduleForm.tsx

    portals/
      PortalTable.tsx
      CreatePortalDialog.tsx
      EditPortalDialog.tsx

    vouchers/
      VoucherGroupTable.tsx
      CreateVoucherDialog.tsx

  pages/
    WifiPage.tsx
    SchedulePage.tsx
    PortalPage.tsx
    VoucherPage.tsx

  services/
    omadaClient.ts
    ssidService.ts
    scheduleService.ts
    portalService.ts
    voucherService.ts

  types/
    ssid.ts
    schedule.ts
    portal.ts
    voucher.ts

  constants/
    omadaEnums.ts

==================================================
20. ENUM CONSTANTS
==================================================

Centralize enum mappings.

Example:

export const DAY_MODES = [
  { value: 0, label: 'Every Day' },
  { value: 1, label: 'Weekdays' },
  { value: 2, label: 'Weekends' },
  { value: 3, label: 'Custom Days' }
];

Do this for:

- day mode
- day type
- SSID bands
- WiFi security
- WPA versions
- encryption
- PMF
- portal auth type
- hotspot auth type
- voucher limit type
- duration type
- timing type
- traffic frequency
- voucher validity type

Do not duplicate these mappings in individual components.

==================================================
21. SAFETY AGAINST BAD OMADA PAYLOADS
==================================================

This is critical.

The Omada API examples often contain placeholder fields such as:

0
""
[]

Some of those values are INVALID when actually sent.

Therefore:

1. Never copy Swagger sample payloads blindly.
2. Only include fields relevant to enabled features.
3. Remove undefined / null / irrelevant nested objects before sending.
4. Implement a payload-cleaning helper.
5. Do not strip valid boolean false values.
6. Do not strip valid numeric zero where zero is a documented valid enum.
7. Do strip fields where zero is an invalid placeholder.

Create explicit request builder functions rather than relying only on generic object cleanup.

Examples:

buildCreateSsidRequest(form)
buildUpdateSsidRequest(currentSsid, form)
buildCreatePortalRequest(form)
buildCreateScheduleRequest(form)
buildCreateVoucherRequest(form)

These should encode the API business rules.

==================================================
22. ACCEPTANCE CRITERIA
==================================================

The implementation is only complete when I can:

1. View SSIDs from Omada.
2. Create a WiFi network.
3. Change an SSID password.
4. Delete an SSID.
5. View all Time Range Profiles.
6. Create a Time Range Profile.
7. Select a schedule from a dropdown.
8. Assign that schedule to an SSID.
9. Select whether WiFi should be ON or OFF during that schedule.
10. View portals.
11. Create a Voucher authentication portal.
12. Associate one or more SSIDs with a portal.
13. Modify portal SSID associations.
14. Delete a portal.
15. View voucher groups.
16. Create a voucher group.
17. See human-readable dropdown values everywhere.
18. Receive meaningful validation before invalid API calls are sent.
19. Receive readable Omada API error messages when the backend rejects something.
20. Refresh the browser without breaking routing.

==================================================
23. IMPLEMENTATION APPROACH
==================================================

Before changing code:

1. Inspect the existing project structure.
2. Identify existing React/MUI/layout/service conventions.
3. Reuse existing components where sensible.
4. Do not rewrite working application infrastructure unnecessarily.
5. Create a short implementation plan.

Then implement incrementally:

Phase 1:
API client and TypeScript types.

Phase 2:
Schedule retrieval and creation.

Phase 3:
SSID list/create/change-password/schedule assignment.

Phase 4:
Portal list/create/edit/delete.

Phase 5:
Voucher list/create.

Phase 6:
Validation, error handling and UI cleanup.

After implementation:

- run TypeScript compilation
- run lint
- fix all errors
- test routes
- test forms
- check payload construction
- ensure no access tokens or credentials are committed

Finally provide a concise report containing:

- files created
- files modified
- implemented endpoints
- remaining unsupported operations
- any API assumptions that still require live testing