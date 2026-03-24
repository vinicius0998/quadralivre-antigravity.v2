import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
    return res.status(400).json({ error: "Instância não criada ainda" });
  }

  const response = await fetch("https://genialchat.uazapi.com/instance/connect", {
    method: "POST",
    headers: {
      Accept: "application/json",
      token: profile.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: "" }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("uazapi connect error:", result);
    return res.status(500).json({ error: result?.message || "Erro ao conectar instância" });
  }

  return res.status(200).json(result);
}
