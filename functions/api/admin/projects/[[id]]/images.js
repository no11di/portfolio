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

function sanitizeFilename(name) {
  return (name || "file")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
}

export const onRequestPost = async ({ env, request, params }) => {
  const projectId = getIdFromParams(params);
  if (!projectId) return json({ ok: false, message: "유효하지 않은 id" }, 400);

  const form = await request.formData().catch(() => null);
  if (!form) return json({ ok: false, message: "form-data가 필요합니다." }, 400);

  const file = form.get("file");
  const sortNo = Number(form.get("sortNo") || 1);

  if (!(file instanceof File)) return json({ ok: false, message: "file이 필요합니다." }, 400);
  if (![1, 2, 3].includes(sortNo)) return json({ ok: false, message: "sortNo는 1~3" }, 400);

  const filename = sanitizeFilename(file.name);
  const objectKey = `projects/${projectId}/${sortNo}/${Date.now()}_${filename}`;

  // R2에 원본 업로드
  await env.MEDIA.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "application/octet-stream" },
  });

  // 같은 projectId+sortNo가 이미 있으면 "교체"로 처리(기존 레코드 삭제 후 삽입)
  await env.DB.prepare(
    `DELETE FROM project_images WHERE project_id = ? AND sort_no = ?`
  ).bind(projectId, sortNo).run();

  await env.DB.prepare(
    `INSERT INTO project_images (project_id, sort_no, object_key, caption)
     VALUES (?, ?, ?, NULL)`
  ).bind(projectId, sortNo, objectKey).run();

  return json({ ok: true, objectKey });
};
