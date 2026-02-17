function notFound() {
  return new Response("Not Found", { status: 404 });
}

function guessContentType(key, fallback = "application/octet-stream") {
  const k = (key || "").toLowerCase();
  if (k.endsWith(".png")) return "image/png";
  if (k.endsWith(".jpg") || k.endsWith(".jpeg")) return "image/jpeg";
  if (k.endsWith(".webp")) return "image/webp";
  if (k.endsWith(".gif")) return "image/gif";
  if (k.endsWith(".svg")) return "image/svg+xml";
  return fallback;
}

function normalizeKeyCandidates(key) {
  const candidates = [];

  // 1) 그대로
  candidates.push(key);

  // 2) prefix가 붙어있을 수도 있는 경우(혹시 업로드 로직이 그렇게 저장했다면)
  //    "portfolio-media/..." 형태를 쓰는 경우 대비
  candidates.push(`portfolio-media/${key}`.replace(/^portfolio-media\/portfolio-media\//, "portfolio-media/"));

  // 3) key에 .png.png 같은 중복 확장자 들어오는 케이스 대응
  //    예: projects/.../abc.png.png -> projects/.../abc.png
  if (key.endsWith(".png.png")) {
    const fixed = key.replace(/\.png\.png$/i, ".png");
    candidates.push(fixed);
    candidates.push(`portfolio-media/${fixed}`.replace(/^portfolio-media\/portfolio-media\//, "portfolio-media/"));
  }
  if (key.endsWith(".jpg.jpg")) {
    const fixed = key.replace(/\.jpg\.jpg$/i, ".jpg");
    candidates.push(fixed);
    candidates.push(`portfolio-media/${fixed}`.replace(/^portfolio-media\/portfolio-media\//, "portfolio-media/"));
  }
  if (key.endsWith(".jpeg.jpeg")) {
    const fixed = key.replace(/\.jpeg\.jpeg$/i, ".jpeg");
    candidates.push(fixed);
    candidates.push(`portfolio-media/${fixed}`.replace(/^portfolio-media\/portfolio-media\//, "portfolio-media/"));
  }

  // 중복 제거
  return [...new Set(candidates)];
}

export const onRequestGet = async ({ request, env }) => {
  const url = new URL(request.url);
  const keyParam = url.searchParams.get("key");
  if (!keyParam) return notFound();

  // keyParam은 이미 URLSearchParams로 디코드되어 들어오는 경우가 많습니다.
  // decodeURIComponent를 무조건 또 하면 %가 섞인 값에서 깨질 수 있어 "안전 디코드"를 합니다.
  let key = keyParam;
  try {
    key = decodeURIComponent(keyParam);
  } catch (_) {
    // 그대로 사용
    key = keyParam;
  }

  // ✅ R2 바인딩 이름을 "반드시" 사용자님 실제 이름으로 맞추셔야 합니다.
  // 지금 프로젝트에서 R2 바인딩이 env.PORTFOLIO_MEDIA 라고 가정합니다.
  // 만약 wrangler.toml에 다른 이름이면 여기만 바꾸면 됩니다.
  const bucket = env.PORTFOLIO_MEDIA;
  if (!bucket) {
    return new Response("R2 binding missing: PORTFOLIO_MEDIA", { status: 500 });
  }

  const candidates = normalizeKeyCandidates(key);

  let obj = null;
  let usedKey = null;

  for (const k of candidates) {
    obj = await bucket.get(k);
    if (obj) { usedKey = k; break; }
  }

  if (!obj) return notFound();

  const headers = new Headers();

  // R2에 httpMetadata(contentType)가 있으면 우선 사용, 없으면 확장자로 추정
  const ct = obj.httpMetadata?.contentType || guessContentType(usedKey);
  headers.set("Content-Type", ct);

  // 캐시 (관리자에서 바로바로 확인해야 하면 max-age를 낮추셔도 됩니다)
  headers.set("Cache-Control", "public, max-age=3600");

  return new Response(obj.body, { headers });
};
