const BODY = `User-agent: *
Disallow: /api/

User-agent: AhrefsBot
User-agent: SemrushBot
User-agent: MJ12bot
User-agent: DotBot
User-agent: Bytespider
User-agent: GPTBot
User-agent: CCBot
Disallow: /
`;

export async function GET() {
  return new Response(BODY, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
