function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safeName(n) {
  return String(n).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}
function guessExt(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  return "png";
}

export const onRequestGet = async ({ env }) => {
  const row = await env.DB.prepare("SELECT * FROM site_settings WHERE id=1").first();
  return json({ ok: true, settings: row || null });
};

// 텍스트(제목/태그라인/인사말) 저장
export const onRequestPatch = async ({ env, request }) => {
  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, message: "body가 필요합니다" }, 400);

  const title = (body.title ?? "").toString();
  const tagline = (body.tagline ?? "").toString();
  const greeting = (body.greeting ?? "").toString();

  await env.DB.prepare(
    `UPDATE site_settings
     SET title=?, tagline=?, greeting=?, updated_at=datetime('now')
     WHERE id=1`
  ).bind(title, tagline, greeting).run();

  return json({ ok: true });
};

// 배너/증명사진 업로드
export const onRequestPost = async ({ env, request }) => {
  const form = await request.formData();
  const type = String(form.get("type") || "banner"); // banner | portrait
  const file = form.get("file");

  if (!(file instanceof File)) return json({ ok: false, message: "file이 필요합니다" }, 400);
  if (!["banner", "portrait"].includes(type)) return json({ ok: false, message: "type은 banner|portrait" }, 400);

  const BUCKET = env.MEDIA; // ✅ 지금 페이지 바인딩 이름이 MEDIA
  if (!BUCKET) return json({ ok: false, message: "R2 binding missing: MEDIA" }, 500);

  const ext = guessExt(file.type);
  const objectKey = `site/${type}/${Date.now()}_${safeName(file.name || type)}.${ext}`;

  await BUCKET.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  if (type === "banner") {
    await env.DB.prepare(
      `UPDATE site_settings SET banner_object_key=?, updated_at=datetime('now') WHERE id=1`
    ).bind(objectKey).run();
  } else {
    await env.DB.prepare(
      `UPDATE site_settings SET portrait_object_key=?, updated_at=datetime('now') WHERE id=1`
    ).bind(objectKey).run();
  }

  return json({ ok: true, objectKey });
};
