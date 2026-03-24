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

  const adminToken = process.env.UAZAPI_ADMIN_TOKEN;
  if (!adminToken) return res.status(500).json({ error: "UAZAPI_ADMIN_TOKEN not configured" });

  // Buscar perfil atual
  const { data: profile } = await supabase
    .from("profiles")
    .select("uazapi_token, uazapi_instance_name, arena_slug")
    .eq("user_id", user.id)
    .single();

  // Se já tem instância, retorna o token existente
  if (profile?.uazapi_token) {
    return res.status(200).json({ token: profile.uazapi_token, instanceName: profile.uazapi_instance_name, existing: true });
  }

  // Criar nova instância
  const instanceName = `arena-${(profile?.arena_slug || user.id.slice(0, 8)).replace(/[^a-z0-9-]/g, "-")}`;

  const response = await fetch("https://genialchat.uazapi.com/instance/init", {
    method: "POST",
    headers: {
      Accept: "application/json",
      admintoken: adminToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: instanceName,
      systemName: "quadralivre",
      fingerprintProfile: "chrome",
      browser: "chrome",
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("uazapi create-instance error:", result);
    return res.status(500).json({ error: result?.message || "Erro ao criar instância" });
  }

  // Salvar token da instância no perfil
  const instanceToken = result.token || result.instance?.token || result.Token;
  if (!instanceToken) {
    console.error("uazapi response missing token:", result);
    return res.status(500).json({ error: "Token não retornado pela uazapi", raw: result });
  }

  await supabase
    .from("profiles")
    .update({ uazapi_token: instanceToken, uazapi_instance_name: instanceName })
    .eq("user_id", user.id);

  return res.status(200).json({ token: instanceToken, instanceName, existing: false });
}
