function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export const onRequestGet = async ({ env }) => {
  const DB = env.DB;

  const settings = await DB.prepare(
    "SELECT * FROM site_settings WHERE id = 1"
  ).first();

  const profile = await DB.prepare(
    "SELECT id, sort_no, text FROM profile_items ORDER BY sort_no ASC, id ASC"
  ).all();

  const contacts = await DB.prepare(
    "SELECT id, sort_no, label, value FROM contact_items ORDER BY sort_no ASC, id ASC"
  ).all();

  const careers = await DB.prepare(
    "SELECT id, sort_no, level, text FROM career_items ORDER BY sort_no ASC, id ASC"
  ).all();

  const skills = await DB.prepare(
    "SELECT id, sort_no, level, name, summary, detail FROM skills ORDER BY level ASC, sort_no ASC, id ASC"
  ).all();

  return json({
    ok: true,
    settings: settings || null,
    profile: profile.results || [],
    contacts: contacts.results || [],
    careers: careers.results || [],
    skills: skills.results || [],
  });
};
