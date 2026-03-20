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
    const { reservationId, amountCents } = req.body;

    if (!reservationId || !amountCents) {
      return res.status(400).json({ error: "reservationId e amountCents são obrigatórios" });
    }

    const ABACATE_API_KEY = process.env.ABACATEPAY_API_KEY;
    if (!ABACATE_API_KEY) {
      return res.status(500).json({ error: "Pagamentos não configurados na plataforma." });
    }

    // Cria PIX QR Code no AbacatePay
    const response = await fetch("https://api.abacatepay.com/v1/pixQrCode/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ABACATE_API_KEY}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        expiresIn: 3600,
        description: "Reserva de Quadra",
      }),
    });

    const data = await response.json();
    console.log("AbacatePay PIX response:", JSON.stringify(data));

    const brCode = data?.data?.brCode;
    const pixId = data?.data?.id;

    if (!brCode) {
      return res.status(400).json({ error: data?.error || "Erro ao gerar PIX" });
    }

    // Salva o payment_id na reserva
    await supabaseAdmin
      .from("reservations")
      .update({
        payment_id: pixId,
        status_pagamento: "pendente",
      })
      .eq("id", reservationId);

    return res.status(200).json({ brCode, id: pixId });
  } catch (error: any) {
    console.error("create-checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
