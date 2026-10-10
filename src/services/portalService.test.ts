import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./omadaClient";
import { updatePortalAppearance } from "./portalService";
import type { Portal } from "../types/omada";

vi.mock("./omadaClient", () => ({
  api: { post: vi.fn(), patch: vi.fn() },
  requireConfig: vi.fn(),
  sitePath: () => "/openapi/v1/controller/sites/site",
  OmadaError: class extends Error {},
}));

const portal = {
  id: "portal-1",
  name: "Guest",
  enable: true,
  ssidList: ["ssid-1"],
  networkList: [],
  authType: 11,
  portalCustomize: {
    backgroundPictureId: "old-picture",
    buttonColor: "#123456",
  },
} as Portal;

describe("portal appearance saving", () => {
  it("uploads a logo and saves its picture ID without changing the background", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { result: { id: "new-logo" } },
    });
    await updatePortalAppearance(
      portal,
      true,
      "",
      undefined,
      new Blob(["logo"], { type: "image/png" }) as File,
    );
    expect(vi.mocked(api.post).mock.calls[0][2]?.params).toEqual({
      type: "logo",
    });
    expect(api.patch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        portalCustomize: expect.objectContaining({
          logoPictureId: "new-logo",
          logoDisplay: true,
          backgroundPictureId: "old-picture",
        }),
      }),
    );
  });
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("uploads multipart background before saving its ID and welcome text", async () => {
    const file = new Blob(["image bytes"], { type: "image/png" }) as File;
    vi.mocked(api.post).mockResolvedValue({
      data: { result: { id: "new-picture" } },
    });
    await updatePortalAppearance(portal, true, " Welcome guests ", file);
    const [url, body, config] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe("/openapi/v1/controller/sites/site/portal/pics");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(config?.params).toEqual({ type: "background" });
    expect(config?.headers?.["Content-Type"]).toBeUndefined();
    expect(api.patch).toHaveBeenCalledWith(
      "/openapi/v1/controller/sites/site/portal/portal-1",
      expect.objectContaining({
        ssidList: ["ssid-1"],
        portalCustomize: expect.objectContaining({
          backgroundPictureId: "new-picture",
          buttonColor: "#123456",
          welcomeInformation: "Welcome guests",
          welcomeEnable: true,
        }),
      }),
    );
  });

  it("keeps the existing background and hides an empty welcome message", async () => {
    await updatePortalAppearance(portal, false, " ");
    expect(api.post).not.toHaveBeenCalled();
    expect(api.patch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        portalCustomize: expect.objectContaining({
          backgroundPictureId: "old-picture",
          welcomeEnable: false,
          logoDisplay: false,
        }),
      }),
    );
  });

  it("does not update the portal when the upload has no picture ID", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { result: {} } });
    await expect(
      updatePortalAppearance(
        portal,
        true,
        "Hello",
        new Blob(["x"], { type: "image/png" }) as File,
      ),
    ).rejects.toThrow("picture ID");
    expect(api.patch).not.toHaveBeenCalled();
  });
});
