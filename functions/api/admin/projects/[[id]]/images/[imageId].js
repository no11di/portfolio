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

export const onRequestPatch = async ({ env, params, request }) => {
  const projectId = getPositiveInt(params?.id);
  const imageId = getPositiveInt(params?.imageId);
  if (!projectId || !imageId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const body = await request.json().catch(() => null);
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

// (참고) DELETE가 이미 있다면 유지, 없다면 아래 형태로
export const onRequestDelete = async ({ env, params }) => {
  const projectId = getPositiveInt(params?.id);
  const imageId = getPositiveInt(params?.imageId);
  if (!projectId || !imageId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  // 1) DB에서 object_key 조회
  const row = await env.DB.prepare(
    `SELECT object_key FROM project_images WHERE id = ? AND project_id = ?`
  ).bind(imageId, projectId).first();

  if (!row?.object_key) return json({ ok: false, message: "대상이 없습니다." }, 404);

  // 2) R2 삭제 (바인딩 이름은 실제 env에 맞추세요: env.BUCKET / env.R2 등)
  // 예: await env.R2.delete(row.object_key);
  // (이미 구현하신 delete 로직이 있다면 그대로 두시면 됩니다.)

  // 3) DB 삭제
  await env.DB.prepare(
    `DELETE FROM project_images WHERE id = ? AND project_id = ?`
  ).bind(imageId, projectId).run();

  return json({ ok: true });
};
