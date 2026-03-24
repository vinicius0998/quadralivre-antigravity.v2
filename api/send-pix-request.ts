import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function detectPixType(key: string): string {
  const digits = key.replace(/\D/g, "");
  if (digits.length === 11 && !key.includes("@")) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (key.includes("@")) return "EMAIL";
  if (key.startsWith("+") || (digits.length === 13 && digits.startsWith("55"))) return "PHONE";
  return "EVP";
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { clientPhone, amount, pixKey, arenaName, courtName, arenaUserId } = req.body;

  if (!clientPhone || !amount || !pixKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Buscar o token da instância WhatsApp da arena específica
  let instanceToken: string | null = null;

  if (arenaUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("uazapi_token")
      .eq("user_id", arenaUserId)
      .single();
    instanceToken = profile?.uazapi_token ?? null;
  }

  if (!instanceToken) {
    // Arena sem WhatsApp conectado: não envia mensagem, mas não quebra o fluxo de reserva
    console.warn(`[send-pix-request] Arena ${arenaUserId} não tem WhatsApp conectado. Mensagem PIX não enviada.`);
    return res.status(200).json({ success: false, reason: "no_whatsapp_instance" });
  }

  const pixType = detectPixType(pixKey);
  const number = formatPhone(clientPhone);
  const text = `Reserva ${courtName || "Quadra"} — ${arenaName || "Arena"}`;

  console.log(`[send-pix-request] Enviando PIX via WhatsApp da arena (token: ...${instanceToken.slice(-6)}) para ${number}`);

  const response = await fetch("https://genialchat.uazapi.com/send/request-payment", {
    method: "POST",
    headers: {
      Accept: "application/json",
      token: instanceToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, amount, text, pixKey, pixType }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("[send-pix-request] uazapi error:", result);
    return res.status(500).json({ error: result?.message || "Erro ao enviar requisição PIX" });
  }

  return res.status(200).json({ success: true });
}
