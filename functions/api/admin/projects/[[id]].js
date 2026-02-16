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
  const projectId = getIdFromParams(params);
  if (!projectId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  // 1) 해당 프로젝트 이미지 키들을 먼저 조회
  const imgRows = await env.DB.prepare(
    `SELECT object_key FROM project_images WHERE project_id = ?`
  ).bind(projectId).all();

  const keys = (imgRows.results || []).map(r => r.object_key).filter(Boolean);

  // 2) R2에서 먼저 삭제 (누락 방지: 실패하면 중단)
  try {
    for (const k of keys) {
      await env.MEDIA.delete(k);
    }
  } catch (e) {
    return json({ ok: false, message: "R2 이미지 삭제 실패로 프로젝트 삭제를 중단했습니다." }, 500);
  }

  // 3) DB에서 이미지 레코드 삭제
  await env.DB.prepare(
    `DELETE FROM project_images WHERE project_id = ?`
  ).bind(projectId).run();

  // 4) 프로젝트 삭제
  const res = await env.DB.prepare(
    `DELETE FROM projects WHERE id = ?`
  ).bind(projectId).run();

  if ((res.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "대상이 없습니다." }, 404);
  }

  return json({ ok: true, deletedImages: keys.length });
};
export const onRequestGet = async ({ env, params }) => {
	  const id = Number(params?.id);
	  if (!Number.isInteger(id) || id <= 0) {
	    return new Response(JSON.stringify({ ok:false, message:"유효하지 않은 id" }), {
	      status: 400,
	      headers: { "content-type":"application/json; charset=utf-8" }
	    });
	  }

	  const row = await env.DB.prepare(
	    `SELECT id, title, description, is_public, pinned, pinned_at, created_at, updated_at
	     FROM projects
	     WHERE id = ?`
	  ).bind(id).first();

	  if (!row) {
	    return new Response(JSON.stringify({ ok:false, message:"대상이 없습니다." }), {
	      status: 404,
	      headers: { "content-type":"application/json; charset=utf-8" }
	    });
	  }

	  return new Response(JSON.stringify({
	    ok: true,
	    project: {
	      id: row.id,
	      title: row.title,
	      description: row.description || "",
	      isPublic: !!row.is_public,
	      pinned: !!row.pinned,
	      pinnedAt: row.pinned_at,
	      createdAt: row.created_at,
	      updatedAt: row.updated_at
	    }
	  }), {
	    headers: { "content-type":"application/json; charset=utf-8" }
	  });
	};
