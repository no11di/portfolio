function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet = async ({ env }) => {
  const rows = await env.DB.prepare(
    `SELECT id, title, description, created_at, updated_at
     FROM projects
     WHERE is_public = 1
     ORDER BY id DESC`
  ).all();

  const projects = (rows.results || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return json({ ok: true, projects });
};
