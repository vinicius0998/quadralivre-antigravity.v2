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
    const ABACATE_API_KEY = process.env.ABACATEPAY_API_KEY;
    if (!ABACATE_API_KEY) {
      return res.status(500).json({ error: "Pagamentos não configurados na plataforma." });
    }

    // Verifica autenticação via Bearer token (Supabase JWT do dono da arena)
    const authHeader: string = req.headers.authorization ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Token de autenticação necessário" });
    }

    const supabaseUser = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return res.status(401).json({ error: "Token inválido" });
    }

    const { amountCents } = req.body;

    if (!amountCents || amountCents <= 0) {
      return res.status(400).json({ error: "Valor inválido para saque" });
    }

    // Busca saldo e chave PIX da arena
    const { data: profile, error: profError } = await supabaseAdmin
      .from("profiles")
      .select("pix_key, balance_cents, arena_name")
      .eq("user_id", user.id)
      .single();

    if (profError || !profile) {
      return res.status(404).json({ error: "Perfil não encontrado" });
    }

    if (!profile.pix_key) {
      return res.status(400).json({ error: "Configure sua chave PIX nas configurações para realizar saques." });
    }

    const currentBalance = profile.balance_cents ?? 0;

    if (amountCents > currentBalance) {
      return res.status(400).json({
        error: `Saldo insuficiente. Seu saldo disponível é R$ ${(currentBalance / 100).toFixed(2).replace(".", ",")}.`,
      });
    }

    // Detecta o tipo da chave PIX
    const detectPixType = (key: string): string => {
      const cleaned = key.replace(/\D/g, "");
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key)) return "EMAIL";
      if (cleaned.length === 11 && !key.includes("-")) return "CPF";
      if (cleaned.length === 14) return "CNPJ";
      if (key.startsWith("+") || (cleaned.length >= 10 && cleaned.length <= 11)) return "PHONE";
      return "EVP"; // chave aleatória
    };

    const pixType = detectPixType(profile.pix_key);

    // Cria o saque no AbacatePay usando a chave da plataforma
    const response = await fetch("https://api.abacatepay.com/v1/withdraw/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ABACATE_API_KEY}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        pix: {
          type: pixType,
          key: profile.pix_key,
        },
        method: "PIX",
        notes: `Saque QuadraLivre - ${profile.arena_name}`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("AbacatePay withdrawal error:", data);
      return res.status(400).json({ error: data?.error || "Erro ao processar saque" });
    }

    // Debita o saldo da arena
    await supabaseAdmin
      .from("profiles")
      .update({ balance_cents: currentBalance - amountCents })
      .eq("user_id", user.id);

    return res.status(200).json({ success: true, ...data });
  } catch (error: any) {
    console.error("create-withdrawal error:", error);
    return res.status(500).json({ error: error.message });
  }
}
