function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet = async ({ env }) => {
  const rows = await env.DB.prepare(
    `SELECT id, title, description, is_public, pinned, pinned_at, created_at, updated_at
     FROM projects
     ORDER BY pinned DESC, pinned_at DESC, id DESC`
  ).all();

  const projects = (rows.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || "",
    isPublic: !!r.is_public,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    pinned: !!r.pinned,
    pinnedAt: r.pinned_at,
  }));

  return json({ ok: true, projects });
};

export const onRequestPost = async ({ env, request }) => {
  const body = await request.json().catch(() => null);
  const title = (body?.title || "").trim();
  const description = (body?.description || "").toString();

  if (!title) return json({ ok: false, message: "title은 필수입니다." }, 400);

  // updated_at은 지금 단계에서는 단순히 created_at과 같이 찍어둡니다.
  const now = new Date().toISOString();

  const result = await env.DB.prepare(
    `INSERT INTO projects (title, description, is_public, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?)`
  )
    .bind(title, description, now, now)
    .run();

  return json({ ok: true, id: result.meta.last_row_id });
};
