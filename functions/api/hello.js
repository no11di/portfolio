export async function onRequest(context) {
  return new Response(
    JSON.stringify({ message: "API works 🎉" }),
    {
      headers: { "content-type": "application/json" }
    }
  );
}
