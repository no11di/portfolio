export async function onRequestPost(context) {
  const { request, params, env } = context;
  const projectId = Number(params.id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return json({ ok: false, message: "유효하지 않은 id" }, 400);
  }

  const DB = env.DB;       // 필요 시 변경
  const BUCKET = env.MEDIA; // 필요 시 변경

  const form = await request.formData();
  const file = form.get("file");
  const sortNo = Number(form.get("sortNo"));
  const caption = form.get("caption") ? String(form.get("caption")) : null;

  if (![1,2,3].includes(sortNo)) return json({ ok: false, message: "sortNo는 1~3" }, 400);
  if (!(file instanceof File)) return json({ ok: false, message: "file이 필요합니다" }, 400);

  // ✅ 1) 기존 이미지 찾기
  const prev = await DB.prepare(
    "SELECT id, object_key FROM project_images WHERE project_id = ? AND sort_no = ?"
  ).bind(projectId, sortNo).first();

  // ✅ 2) 기존 R2 + DB 정리 (교체 업로드 핵심)
  if (prev?.object_key) {
    await BUCKET.delete(prev.object_key);
    await DB.prepare("DELETE FROM project_images WHERE id = ?").bind(prev.id).run();
  }

  // ✅ 3) 새 object_key 생성
  const ext = guessExt(file.type) || "png";
  const objectKey = `projects/${projectId}/${sortNo}/${Date.now()}_${safeName(file.name || "image")}.${ext}`;

  // ✅ 4) R2 업로드
  const arrayBuf = await file.arrayBuffer();
  await BUCKET.put(objectKey, arrayBuf, {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  // ✅ 5) DB insert
  await DB.prepare(
    "INSERT INTO project_images (project_id, sort_no, object_key, caption) VALUES (?, ?, ?, ?)"
  ).bind(projectId, sortNo, objectKey, caption).run();

  return json({ ok: true, objectKey });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function safeName(n) {
  return String(n).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
}
function guessExt(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  return null;
}
