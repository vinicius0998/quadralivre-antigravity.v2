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

  if (!clientPhone || !amount || !pixKey || !arenaUserId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Buscar o token da inst\u00e2ncia WhatsApp da arena espec\u00edfica
  let token: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("uazapi_token")
    .eq("user_id", arenaUserId)
    .single();
  token = profile?.uazapi_token ?? null;

  // Fallback para token global se a arena n\u00e3o tiver WhatsApp conectado
  if (!token) {
    token = process.env.UAZAPI_TOKEN ?? null;
  }

  if (!token) {
    console.warn(`[send-pix-request] Arena ${arenaUserId} sem WhatsApp conectado.`);
    return res.status(200).json({ success: false, reason: "no_instance" });
  }

  const number = formatPhone(clientPhone);
  const pixType = detectPixType(pixKey);
  const text = `Reserva ${courtName || "Quadra"} \u2014 ${arenaName || "Arena"}`;

  console.log(`[send-pix-request] Enviando request-payment para ${number} | valor: ${amount} | pixType: ${pixType}`);

  try {
    const response = await fetch("https://genialchat.uazapi.com/send/request-payment", {
      method: "POST",
      headers: {
        Accept: "application/json",
        token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        number,          // ex: 5562999878349
        amount,          // valor num\u00e9rico (ex: 29.90) \u2014 j\u00e1 embutido no QR Code PIX
        text,            // descri\u00e7\u00e3o exibida no WhatsApp
        pixKey,          // chave PIX da arena
        pixType,         // CPF | CNPJ | EMAIL | PHONE | EVP (detectado automaticamente)
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[send-pix-request] uazapi error:", JSON.stringify(result));
      return res.status(500).json({ error: result?.message || "Erro ao enviar PIX", _raw: result });
    }

    console.log("[send-pix-request] PIX enviado com sucesso!", JSON.stringify(result));
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[send-pix-request] Exception:", error.message);
    return res.status(500).json({ error: "Erro na comunica\u00e7\u00e3o com API WhatsApp" });
  }
}
