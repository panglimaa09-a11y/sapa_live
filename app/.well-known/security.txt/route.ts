const BODY = `Contact: https://sapalive.my.id/safety
Expires: 2027-10-15T00:00:00.000Z
Preferred-Languages: id, en
`;

export async function GET() {
  return new Response(BODY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
