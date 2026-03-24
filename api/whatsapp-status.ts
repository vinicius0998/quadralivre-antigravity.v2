import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("uazapi_token")
    .eq("user_id", user.id)
    .single();

  if (!profile?.uazapi_token) {
    return res.status(200).json({ connected: false, status: "no_instance" });
  }

  const response = await fetch("https://genialchat.uazapi.com/instance/status", {
    method: "GET",
    headers: {
      Accept: "application/json",
      token: profile.uazapi_token,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    return res.status(200).json({ connected: false, status: "error", raw: result });
  }

  // uazapi retorna diferentes campos dependendo da versão
  const status = result.status || result.state || result.Status || "";
  const connected = status === "open" || status === "connected" || status === "CONNECTED";

  return res.status(200).json({ connected, status, phone: result.phone || result.wid || null, raw: result });
}
