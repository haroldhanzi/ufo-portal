export const config = { api: { bodyParser: false } };

function getOmadaOrigin() {
  const configuredOrigin =
    process.env.OMADA_BASE_URL ||
    process.env.VITE_OMADA_BASE_URL ||
    "https://euw1-omada-northbound.tplinkcloud.com";

  try {
    const origin = new URL(configuredOrigin);
    return origin.protocol === "https:" ? origin.origin : undefined;
  } catch {
    return undefined;
  }
}

function appendQuery(url, query) {
  for (const [key, value] of Object.entries(query)) {
    if (key === "upstreamPath" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, String(item));
    }
  }
}

export default async function handler(request, response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type",
  );

  if (request.method === "OPTIONS") return response.status(204).end();

  if (!["GET", "POST", "PATCH", "DELETE"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
    return response
      .status(405)
      .json({ errorCode: -1, msg: "Method not allowed." });
  }

  const omadaOrigin = getOmadaOrigin();
  if (!omadaOrigin) {
    return response.status(500).json({
      errorCode: -1,
      msg: "OMADA_BASE_URL (or VITE_OMADA_BASE_URL) must be a valid HTTPS URL.",
    });
  }

  const pathValue = request.query.upstreamPath;
  const upstreamPath = Array.isArray(pathValue)
    ? pathValue.join("/")
    : pathValue;
  if (!upstreamPath) {
    return response
      .status(400)
      .json({ errorCode: -1, msg: "Missing Omada API path." });
  }

  const upstreamUrl = new URL(`/${upstreamPath}`, omadaOrigin);
  appendQuery(upstreamUrl, request.query);
  const headers = {
    "Content-Type": request.headers["content-type"] || "application/json",
  };
  if (request.headers.authorization)
    headers.Authorization = request.headers.authorization;

  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    let body;
    if (hasBody) {
      if (request.body !== undefined) {
        body =
          Buffer.isBuffer(request.body) || typeof request.body === "string"
            ? request.body
            : JSON.stringify(request.body);
      } else {
        const chunks = [];
        for await (const chunk of request) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        body = Buffer.concat(chunks);
      }
    }
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "follow",
    });
    const contentType = upstream.headers.get("content-type");
    if (contentType) response.setHeader("Content-Type", contentType);
    return response.status(upstream.status).send(await upstream.text());
  } catch (error) {
    return response.status(502).json({
      errorCode: -1,
      msg: error instanceof Error ? error.message : "Omada proxy failed.",
    });
  }
}
