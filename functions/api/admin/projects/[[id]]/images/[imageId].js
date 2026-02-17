function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getPositiveInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function readBodyAsObject(request) {
  const ct = request.headers.get("content-type") || "";

  // 1) JSON
  if (ct.includes("application/json")) {
    return await request.json().catch(() => null);
  }

  // 2) multipart/form-data or x-www-form-urlencoded
  if (ct.includes("multipart/form-data") || ct.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData().catch(() => null);
    if (!form) return null;
    const obj = {};
    for (const [k, v] of form.entries()) obj[k] = v;
    return obj;
  }

  // 3) fallback: try json
  return await request.json().catch(() => null);
}

export const onRequestPatch = async ({ env, params, request }) => {
  const projectId = getPositiveInt(params?.id);
  const imageId = getPositiveInt(params?.imageId);
  if (!projectId || !imageId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const body = await readBodyAsObject(request);
  const caption = (body?.caption ?? "").toString(); // 빈 문자열 허용(= 캡션 삭제)

  const res = await env.DB.prepare(
    `UPDATE project_images
     SET caption = ?
     WHERE id = ? AND project_id = ?`
  ).bind(caption, imageId, projectId).run();

  if ((res.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "대상이 없습니다." }, 404);
  }

  return json({ ok: true, id: imageId, projectId, caption });
};

export const onRequestDelete = async ({ env, params }) => {
  const projectId = getPositiveInt(params?.id);
  const imageId = getPositiveInt(params?.imageId);
  if (!projectId || !imageId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const row = await env.DB.prepare(
    `SELECT object_key FROM project_images WHERE id = ? AND project_id = ?`
  ).bind(imageId, projectId).first();

  if (!row?.object_key) return json({ ok: false, message: "대상이 없습니다." }, 404);

  // ✅ R2 삭제 (Pages 바인딩: MEDIA)
  const BUCKET = env.MEDIA;
  if (!BUCKET) return json({ ok: false, message: "R2 binding missing: MEDIA" }, 500);

  await BUCKET.delete(row.object_key);

  // ✅ DB 삭제
  await env.DB.prepare(
    `DELETE FROM project_images WHERE id = ? AND project_id = ?`
  ).bind(imageId, projectId).run();

  return json({ ok: true });
};
