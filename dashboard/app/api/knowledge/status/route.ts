export const runtime = "nodejs";

export async function GET() {
  const configured = Boolean(
    process.env.OLIVESOFT_UPLOAD_TEAM_PASSWORD &&
    process.env.OLIVESOFT_N8N_UPLOAD_URL &&
    process.env.OLIVESOFT_N8N_UPLOAD_API_KEY,
  );
  return Response.json({ configured }, { headers: { "Cache-Control": "no-store" } });
}
