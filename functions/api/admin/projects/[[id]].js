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

export const onRequestPatch = async ({ env, request, params }) => {
  const id = getIdFromParams(params);
  if (!id) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const body = await request.json().catch(() => null);
  const title = (body?.title ?? "").toString().trim();
  const description = (body?.description ?? "").toString();

  if (!title) return json({ ok: false, message: "title은 필수입니다." }, 400);

  const now = new Date().toISOString();

  const res = await env.DB.prepare(
    `UPDATE projects
     SET title = ?, description = ?, updated_at = ?
     WHERE id = ?`
  ).bind(title, description, now, id).run();

  if ((res.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "대상이 없습니다." }, 404);
  }

  return json({ ok: true });
};

export const onRequestDelete = async ({ env, params }) => {
  const id = getIdFromParams(params);
  if (!id) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const res = await env.DB.prepare(`DELETE FROM projects WHERE id = ?`)
    .bind(id)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "대상이 없습니다." }, 404);
  }

  return json({ ok: true });
};
