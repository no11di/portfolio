function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getIdFromParams(params) {
  const raw = params?.id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const onRequestPatch = async ({ env, params, request }) => {
  const id = getIdFromParams(params);
  if (!id) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  // body: { isPublic: true/false }
  const body = await request.json().catch(() => null);
  const isPublic = !!body?.isPublic;

  const now = new Date().toISOString();

  const res = await env.DB.prepare(
    `UPDATE projects
     SET is_public = ?, updated_at = ?
     WHERE id = ?`
  ).bind(isPublic ? 1 : 0, now, id).run();

  if ((res.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "대상이 없습니다." }, 404);
  }

  return json({ ok: true, isPublic });
};
