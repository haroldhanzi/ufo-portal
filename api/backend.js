export const config = { api: { bodyParser: false } };
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method))
    return response.status(405).json({ message: "Method not allowed" });
  let origin;
  try {
    origin = new URL(process.env.BACKEND_URL);
    if (origin.protocol !== "https:") throw new Error();
  } catch {
    return response
      .status(503)
      .json({ message: "Spring backend URL is not configured" });
  }
  const value = request.query.upstreamPath;
  const path = Array.isArray(value) ? value.join("/") : value;
  if (
    !path ||
    path.includes("..") ||
    path.includes("%") ||
    !/^(auth|users|sites|monitoring|omada)(\/|$)/.test(path)
  )
    return response.status(400).json({ message: "Invalid backend path" });
  const url = new URL(`/api/${path}`, origin.origin);
  for (const [key, value] of Object.entries(request.query)) {
    if (key !== "upstreamPath" && value !== undefined)
      for (const item of Array.isArray(value) ? value : [value])
        url.searchParams.append(key, String(item));
  }
  const headers = {};
  if (request.headers.authorization)
    headers.Authorization = request.headers.authorization;
  if (request.headers["content-type"])
    headers["Content-Type"] = request.headers["content-type"];
  try {
    let body;
    if (request.method !== "GET") {
      if (request.body !== undefined)
        body =
          Buffer.isBuffer(request.body) || typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body);
      else {
        const chunks = [];
        for await (const chunk of request)
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        body = Buffer.concat(chunks);
      }
    }
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
    const type = upstream.headers.get("content-type");
    if (type) response.setHeader("Content-Type", type);
    return response
      .status(upstream.status)
      .send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return response
      .status(502)
      .json({ message: "Unable to reach Spring backend" });
  }
}
