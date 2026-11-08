import { Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import handler from "./backend.js";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("forwards bearer and multipart to Spring without changing bytes or boundary", async () => {
  vi.stubEnv("BACKEND_URL", "https://spring.example.com");
  const bytes = Buffer.from([0, 255, 13, 10, 128]);
  const request = Readable.from([bytes]);
  request.method = "POST";
  request.query = {
    upstreamPath: "omada/v1/sites/site/portal/pics",
    type: "logo",
  };
  request.headers = {
    "content-type": "multipart/form-data; boundary=test",
    authorization: "Bearer user-token",
  };
  const fetch = vi
    .fn()
    .mockResolvedValue({
      headers: new Headers(),
      status: 200,
      arrayBuffer: async () => new Uint8Array([123, 125]).buffer,
    });
  vi.stubGlobal("fetch", fetch);
  const response = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
  await handler(request, response);
  const [url, options] = fetch.mock.calls[0];
  expect(url.pathname).toBe("/api/omada/v1/sites/site/portal/pics");
  expect(url.searchParams.get("type")).toBe("logo");
  expect(options.headers.Authorization).toBe("Bearer user-token");
  expect(options.headers["Content-Type"]).toBe(request.headers["content-type"]);
  expect(options.body).toEqual(bytes);
  expect(response.status).toHaveBeenCalledWith(200);
});
