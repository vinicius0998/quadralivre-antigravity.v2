import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Verifica autenticação via Bearer token (Supabase JWT do dono da arena)
    const authHeader: string = req.headers.authorization ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token de autenticação necessário" });
    }

    // Valida o token e pega o usuário
    const supabaseUser = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const { amountCents, notes } = req.body;

    if (!amountCents || amountCents <= 0) {
      return res.status(400).json({ error: "Valor inválido para saque" });
    }

    // Busca a API key e PIX key da arena
    const { data: profile, error: profError } = await supabaseAdmin
      .from("profiles")
      .select("abacatepay_api_key, pix_key, arena_name")
      .eq("user_id", user.id)
      .single();

    if (profError || !profile) {
      return res.status(404).json({ error: "Perfil não encontrado" });
    }

    if (!profile.abacatepay_api_key) {
      return res.status(400).json({ error: "Configure sua API key do AbacatePay nas configurações." });
    }

    if (!profile.pix_key) {
      return res.status(400).json({ error: "Configure sua chave PIX nas configurações para realizar saques." });
    }

    // Cria o saque no AbacatePay
    const response = await fetch("https://api.abacatepay.com/v1/withdraw/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${profile.abacatepay_api_key}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        pixKey: profile.pix_key,
        notes: notes || `Saque QuadraLivre - ${profile.arena_name}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("AbacatePay withdrawal error:", data);
      return res.status(400).json({ error: data?.error || "Erro ao criar saque no AbacatePay" });
    }

    return res.status(200).json(data);
  } catch (error: any) {
    console.error("create-withdrawal error:", error);
    return res.status(500).json({ error: error.message });
  }
}
