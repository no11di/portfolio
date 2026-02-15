export const onRequest = async () => {
  return new Response("HELLO_API_WORKS", {
    headers: { "content-type": "text/plain" }
  });
};
