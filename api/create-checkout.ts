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

    // Busca a reserva para pegar o user_id (dono da arena)
    const { data: reservation, error: resError } = await supabaseAdmin
      .from("reservations")
      .select("id, user_id")
      .eq("id", reservationId)
      .single();

    if (resError || !reservation) {
      return res.status(404).json({ error: "Reserva não encontrada" });
    }

    // Busca a API key do AbacatePay da arena
    const { data: profile, error: profError } = await supabaseAdmin
      .from("profiles")
      .select("abacatepay_api_key, arena_name")
      .eq("user_id", reservation.user_id)
      .single();

    if (profError || !profile?.abacatepay_api_key) {
      return res.status(400).json({ error: "Arena não configurou a API do AbacatePay ainda." });
    }

    // Cria o checkout no AbacatePay
    const response = await fetch("https://api.abacatepay.com/v1/checkouts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${profile.abacatepay_api_key}`,
      },
      body: JSON.stringify({
        items: [
          {
            id: `reserva-${reservationId}`,
            quantity: 1,
            price: amountCents,
          },
        ],
        externalId: reservationId,
        returnUrl: returnUrl,
        completionUrl: completionUrl,
        methods: ["PIX"],
        ...(customerName && {
          customer: {
            name: customerName,
            cellphone: customerPhone || undefined,
          },
        }),
      }),
    });

    const data = await response.json();

    if (!data?.data?.url) {
      console.error("AbacatePay error:", data);
      return res.status(400).json({ error: data?.error || "Erro ao criar cobrança no AbacatePay" });
    }

    // Salva payment_id e payment_url na reserva
    await supabaseAdmin
      .from("reservations")
      .update({
        payment_id: data.data.id,
        payment_url: data.data.url,
        status_pagamento: "pendente",
      })
      .eq("id", reservationId);

    return res.status(200).json({ url: data.data.url, id: data.data.id });
  } catch (error: any) {
    console.error("create-checkout error:", error);
    return res.status(500).json({ error: error.message });
  }
}
