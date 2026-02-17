function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function toInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export const onRequestDelete = async ({ env, params }) => {
  const projectId = toInt(params?.id);
  const imageId = toInt(params?.imageId);

  if (!projectId) return json({ ok: false, message: "유효하지 않은 project id" }, 400);
  if (!imageId) return json({ ok: false, message: "유효하지 않은 image id" }, 400);

  // 1) 해당 이미지가 이 프로젝트에 속하는지 확인 + object_key 확보
  const rowRes = await env.DB.prepare(
    `SELECT id, project_id, object_key
     FROM project_images
     WHERE id = ? AND project_id = ?`
  ).bind(imageId, projectId).first();

  if (!rowRes) {
    return json({ ok: false, message: "이미지를 찾을 수 없습니다." }, 404);
  }

  const objectKey = rowRes.object_key; // 예: "projects/11/1/xxx.png"
  if (!objectKey) {
    return json({ ok: false, message: "object_key가 없습니다." }, 500);
  }

  // 2) R2 삭제 (버킷명 'portfolio-media'를 key에 붙이면 안 됩니다)
  // env.MEDIA 또는 env.R2 등, 사용자님 프로젝트에 실제 바인딩된 이름을 사용해야 합니다.
  // 지금 업로드가 되고 있으니, 업로드 코드에서 쓰는 바인딩 이름과 동일해야 합니다.
  // 예: env.MEDIA.delete(objectKey)
  try {
    // ⭐ 여기 "MEDIA"는 예시입니다.
    // 업로드 코드에서 쓰는 바인딩 이름으로 바꿔주세요.
    await env.MEDIA.delete(objectKey);
  } catch (e) {
    // R2에서 이미 없을 수도 있으니, 여기서 바로 실패시키지 않고 진행할지 선택 가능
    // 일단은 실패로 처리하지 않고 계속 진행하는 방식이 유지보수에 유리합니다.
  }

  // 3) DB row 삭제
  const delRes = await env.DB.prepare(
    `DELETE FROM project_images WHERE id = ? AND project_id = ?`
  ).bind(imageId, projectId).run();

  if ((delRes.meta?.changes ?? 0) === 0) {
    return json({ ok: false, message: "삭제 대상이 없습니다." }, 404);
  }

  return json({ ok: true, deleted: { projectId, imageId, objectKey } });
};
