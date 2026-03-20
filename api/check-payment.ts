import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { reservationId } = req.query;

  if (!reservationId) {
    return res.status(400).json({ error: "reservationId obrigatório" });
  }

  try {
    // Busca a reserva para pegar o payment_id
    const { data: reservation } = await supabaseAdmin
      .from("reservations")
      .select("id, user_id, payment_id, status_pagamento")
      .eq("id", reservationId)
      .single();

    if (!reservation) {
      return res.status(404).json({ error: "Reserva não encontrada" });
    }

    // Se já está pago no banco, retorna imediatamente
    if (reservation.status_pagamento === "pago") {
      return res.status(200).json({ paid: true });
    }

    if (!reservation.payment_id) {
      return res.status(200).json({ paid: false });
    }

    const ABACATE_API_KEY = process.env.ABACATEPAY_API_KEY;
    if (!ABACATE_API_KEY) {
      return res.status(500).json({ error: "API key não configurada" });
    }

    // Consulta status do PIX direto no AbacatePay
    const response = await fetch(
      `https://api.abacatepay.com/v1/pixQrCode/getOne?id=${reservation.payment_id}`,
      {
        headers: { Authorization: `Bearer ${ABACATE_API_KEY}` },
      }
    );

    const data = await response.json();
    console.log("AbacatePay check-payment response:", JSON.stringify(data));

    const status = data?.data?.status ?? data?.data?.pixQrCode?.status ?? "";
    const amountPaidCents = data?.data?.amount ?? data?.data?.pixQrCode?.amount ?? 0;

    if (status === "PAID") {
      // Atualiza a reserva como paga
      await supabaseAdmin
        .from("reservations")
        .update({
          status_pagamento: "pago",
          amount_paid: amountPaidCents / 100,
          status: "agendado",
        })
        .eq("id", reservation.id);

      // Credita saldo da arena
      try {
        await supabaseAdmin.rpc("increment_balance" as any, {
          p_user_id: reservation.user_id,
          p_amount_cents: amountPaidCents,
        });
      } catch (e) {
        console.error("increment_balance error:", e);
      }

      return res.status(200).json({ paid: true });
    }

    return res.status(200).json({ paid: false, status });
  } catch (error: any) {
    console.error("check-payment error:", error);
    return res.status(500).json({ error: error.message });
  }
}
