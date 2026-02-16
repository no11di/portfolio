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

export const onRequestGet = async ({ env, params }) => {
  const projectId = getIdFromParams(params);
  if (!projectId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const rows = await env.DB.prepare(
    `SELECT id, project_id, sort_no, object_key, caption, created_at
     FROM project_images
     WHERE project_id = ?
     ORDER BY sort_no ASC`
  ).bind(projectId).all();

  return json({ ok: true, images: rows.results || [] });
};
