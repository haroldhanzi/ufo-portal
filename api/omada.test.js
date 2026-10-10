import { Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import handler from "./omada.js";

afterEach(() => vi.unstubAllGlobals());

it("forwards multipart bytes, boundary, authorization and picture type", async () => {
  const bytes = Buffer.from([0, 255, 13, 10, 128]);
  const request = Readable.from([bytes]);
  request.method = "POST";
  request.query = {
    upstreamPath: "openapi/v1/controller/sites/site/portal/pics",
    type: "background",
  };
  request.headers = {
    "content-type": "multipart/form-data; boundary=test",
    authorization: "AccessToken=test",
  };
  const fetch = vi
    .fn()
    .mockResolvedValue({
      headers: new Headers(),
      status: 200,
      text: async () => "ok",
    });
  vi.stubGlobal("fetch", fetch);
  const response = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  await handler(request, response);
  const [url, options] = fetch.mock.calls[0];
  expect(url.searchParams.get("type")).toBe("background");
  expect(options.headers["Content-Type"]).toBe(request.headers["content-type"]);
  expect(options.headers.Authorization).toBe("AccessToken=test");
  expect(options.body).toEqual(bytes);
  expect(response.status).toHaveBeenCalledWith(200);
  expect(response.send).toHaveBeenCalledWith("ok");
});
