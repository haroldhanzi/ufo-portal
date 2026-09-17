const OMADA_ORIGIN = "https://euw1-omada-northbound.tplinkcloud.com";

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

  if (request.method === "OPTIONS") {
    return response.status(204).end();
  }

  const incomingUrl = new URL(request.url, "https://vercel.local");
  const upstreamPath = incomingUrl.pathname.replace(/^\/api\/omada/, "");
  const upstreamUrl = `${OMADA_ORIGIN}${upstreamPath}${incomingUrl.search}`;
  const headers = { "Content-Type": "application/json" };
  if (request.headers.authorization) {
    headers.Authorization = request.headers.authorization;
  }

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody
    ? typeof request.body === "string"
      ? request.body
      : JSON.stringify(request.body ?? {})
    : undefined;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      redirect: "follow",
    });
    const contentType = upstream.headers.get("content-type");
    if (contentType) response.setHeader("Content-Type", contentType);
    const payload = await upstream.text();
    return response.status(upstream.status).send(payload);
  } catch (error) {
    return response.status(502).json({
      errorCode: -1,
      msg: error instanceof Error ? error.message : "Omada proxy failed.",
    });
  }
}
