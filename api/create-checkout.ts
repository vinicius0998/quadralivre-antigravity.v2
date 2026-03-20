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
    const { reservationId, amountCents, customerName, customerPhone, returnUrl, completionUrl } = req.body;

    if (!reservationId || !amountCents) {
      return res.status(400).json({ error: "reservationId e amountCents são obrigatórios" });
    }

    const ABACATE_API_KEY = process.env.ABACATEPAY_API_KEY;
    if (!ABACATE_API_KEY) {
      return res.status(500).json({ error: "Pagamentos não configurados na plataforma." });
    }

    // Cria o billing no AbacatePay usando a chave da plataforma
    const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ABACATE_API_KEY}`,
      },
      body: JSON.stringify({
        frequency: "ONE_TIME",
        methods: ["PIX"],
        products: [
          {
            externalId: `reserva-${reservationId}`,
            name: "Reserva de Quadra",
            quantity: 1,
            price: amountCents,
          },
        ],
        returnUrl: returnUrl,
        completionUrl: completionUrl,
      }),
    });

    const data = await response.json();
    console.log("AbacatePay response:", JSON.stringify(data));

    const billingUrl = data?.data?.url;
    if (!billingUrl) {
      console.error("AbacatePay error:", data);
      return res.status(400).json({ error: data?.error || "Erro ao criar cobrança no AbacatePay" });
    }

    // Salva payment_id e payment_url na reserva
    await supabaseAdmin
      .from("reservations")
      .update({
        payment_id: data.data.id,
        payment_url: billingUrl,
        status_pagamento: "pendente",
      })
      .eq("id", reservationId);

    return res.status(200).json({ url: billingUrl, id: data.data.id });
  } catch (error: any) {
    console.error("create-checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
