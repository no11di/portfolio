export async function onRequestPost(context) {
  const { request, params, env } = context;
  const projectId = Number(params.id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return json({ ok: false, message: "유효하지 않은 id" }, 400);
  }

  const DB = env.DB;
  const BUCKET = env.MEDIA; // ✅ Pages 바인딩 이름이 MEDIA

  const form = await request.formData();
  const file = form.get("file");
  const sortNo = Number(form.get("sortNo"));
  const caption = form.get("caption") !== null ? String(form.get("caption")) : null;

  if (![1, 2, 3].includes(sortNo)) return json({ ok: false, message: "sortNo는 1~3" }, 400);
  if (!(file instanceof File)) return json({ ok: false, message: "file이 필요합니다" }, 400);

  // ✅ 1) 기존 이미지 찾기
  const prev = await DB.prepare(
    "SELECT id, object_key FROM project_images WHERE project_id = ? AND sort_no = ?"
  ).bind(projectId, sortNo).first();

  // ✅ 2) 기존 R2 + DB 정리 (교체 업로드)
  if (prev?.object_key) {
    await BUCKET.delete(prev.object_key);
    await DB.prepare("DELETE FROM project_images WHERE id = ?").bind(prev.id).run();
  }

  // ✅ 3) 새 object_key 생성 (.png.png 방지)
  const ext = guessExt(file.type) || getExtFromName(file.name) || "png";
  const base = stripExt(file.name || "image");
  const finalName = `${safeName(base)}.${ext}`; // ✅ ext 딱 1번만
  const objectKey = `projects/${projectId}/${sortNo}/${Date.now()}_${finalName}`;

  // ✅ 4) R2 업로드
  const arrayBuf = await file.arrayBuffer();
  await BUCKET.put(objectKey, arrayBuf, {
    httpMetadata: { contentType: file.type || guessMimeByExt(ext) },
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

function stripExt(filename = "") {
  return String(filename).replace(/\.[a-z0-9]+$/i, "");
}

function getExtFromName(filename = "") {
  const m = String(filename).toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : null;
}

function guessExt(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  return null;
}

function guessMimeByExt(ext) {
  const e = String(ext || "").toLowerCase();
  if (e === "png") return "image/png";
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "application/octet-stream";
}
