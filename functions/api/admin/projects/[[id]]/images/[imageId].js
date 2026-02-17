export async function onRequest(context) {
  const { request, params, env } = context;
  const method = request.method.toUpperCase();

  if (method === "DELETE") return handleDelete(context);
  if (method === "PATCH") return handlePatch(context);

  return json({ ok: false, message: "Method Not Allowed" }, 405);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function mustInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ✅ 바인딩 이름을 프로젝트에 맞추세요
function getDB(env) {
  return env.DB;       // <- 필요 시 변경
}
function getBucket(env) {
  return env.MEDIA;    // <- 필요 시 변경 (R2)
}

// DELETE: 이미지 1개 삭제 (DB row + R2 object)
async function handleDelete({ params, env }) {
  const projectId = mustInt(params.id);
  const imageId = mustInt(params.imageId);
  if (!projectId || !imageId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const DB = getDB(env);
  const BUCKET = getBucket(env);

  // 1) 이미지 row 조회 (project 소속 검증)
  const row = await DB.prepare(
    "SELECT id, project_id, object_key FROM project_images WHERE id = ? AND project_id = ?"
  ).bind(imageId, projectId).first();

  if (!row) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  // 2) R2 삭제 (있으면)
  if (row.object_key) {
    await BUCKET.delete(row.object_key);
  }

  // 3) DB 삭제
  await DB.prepare("DELETE FROM project_images WHERE id = ?").bind(imageId).run();

  return json({ ok: true });
}

// PATCH: 캡션 저장
async function handlePatch({ request, params, env }) {
  const projectId = mustInt(params.id);
  const imageId = mustInt(params.imageId);
  if (!projectId || !imageId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  let payload = null;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, message: "JSON 파싱 실패" }, 400);
  }

  const captionRaw = payload?.caption;
  // caption은 null(삭제) 또는 문자열
  const caption =
    captionRaw === null || captionRaw === undefined
      ? null
      : String(captionRaw);

  // 길이 제한(원하시면 조정)
  if (caption !== null && caption.length > 200) {
    return json({ ok: false, message: "caption이 너무 깁니다(최대 200자)" }, 400);
  }

  const DB = getDB(env);

  // 소속 검증 + 업데이트
  const exists = await DB.prepare(
    "SELECT id FROM project_images WHERE id = ? AND project_id = ?"
  ).bind(imageId, projectId).first();

  if (!exists) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  await DB.prepare(
    "UPDATE project_images SET caption = ? WHERE id = ? AND project_id = ?"
  ).bind(caption, imageId, projectId).run();

  return json({ ok: true });
}
