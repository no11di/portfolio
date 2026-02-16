function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getIdFromParams(params) {
  const id = Number(params?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export const onRequestPatch = async ({ env, params, request }) => {
  const id = getIdFromParams(params);
  if (!id) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  // body: { pinned: true/false }
  const body = await request.json().catch(() => null);
  const pinned = !!body?.pinned;

  const now = new Date().toISOString();

  const res = await env.DB.prepare(
    `UPDATE projects
     SET pinned = ?, pinned_at = ?
     WHERE id = ?`
  ).bind(pinned ? 1 : 0, pinned ? now : null, id).run();

  if ((res.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "대상이 없습니다." }, 404);
  }

  return json({ ok: true, pinned });
};
