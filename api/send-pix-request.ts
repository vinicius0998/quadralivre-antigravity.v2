import type { VercelRequest, VercelResponse } from "@vercel/node";

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

  const { clientPhone, amount, pixKey, arenaName, courtName } = req.body;

  if (!clientPhone || !amount || !pixKey) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const token = process.env.UAZAPI_TOKEN;
  if (!token) return res.status(500).json({ error: "UAZAPI_TOKEN not configured" });

  const pixType = detectPixType(pixKey);
  const number = formatPhone(clientPhone);
  const text = `Reserva ${courtName || "Quadra"} — ${arenaName || "Arena"}`;

  const response = await fetch("https://genialchat.uazapi.com/send/request-payment", {
    method: "POST",
    headers: {
      Accept: "application/json",
      token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, amount, text, pixKey, pixType }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("uazapi error:", result);
    return res.status(500).json({ error: result?.message || "Erro ao enviar requisição PIX" });
  }

  return res.status(200).json({ success: true });
}
