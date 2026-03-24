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

  // Se não tem instância, apenas limpa o banco (idempotente)
  if (profile?.uazapi_token) {
    // Tenta deletar a instância na uazapi (ignora erros)
    try {
      await fetch("https://genialchat.uazapi.com/instance/delete", {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          token: profile.uazapi_token,
        },
      });
    } catch (e) {
      console.warn("[whatsapp-disconnect] Erro ao deletar instância uazapi:", e);
    }
  }

  // Limpa token e nome da instância no banco
  await supabase
    .from("profiles")
    .update({ uazapi_token: null, uazapi_instance_name: null })
    .eq("user_id", user.id);

  return res.status(200).json({ success: true });
}
