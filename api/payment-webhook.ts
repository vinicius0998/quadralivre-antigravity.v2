import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Sempre retorna 200 para o AbacatePay não retentar
  try {
    const event = req.body;
    const eventType: string = event?.event ?? "";
    const paymentData = event?.data ?? {};

    console.log("Webhook payload:", JSON.stringify(event));

    const pixEvents = ["billing.paid", "pixQrCode.paid", "checkout.completed", "transparent.completed"];
    if (!pixEvents.includes(eventType)) {
      return res.status(200).json({ received: true });
    }

    // Extrai o payment ID do campo pixQrCode (formato confirmado pelo payload real)
    const paymentId: string =
      paymentData?.pixQrCode?.id ??
      paymentData?.id ??
      paymentData?.billing?.id ??
      paymentData?.checkout?.id ?? "";

    const amountPaidCents: number =
      paymentData?.pixQrCode?.amount ??
      paymentData?.payment?.amount ??
      paymentData?.amount ?? 0;

    console.log("paymentId:", paymentId, "amount:", amountPaidCents);

    if (!paymentId) {
      console.warn("Sem paymentId no payload");
      return res.status(200).json({ received: true });
    }

    // Busca reserva pelo payment_id salvo no create-checkout
    const { data: reservation } = await supabaseAdmin
      .from("reservations")
      .select("id, user_id, status_pagamento")
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (!reservation) {
      console.warn("Reserva não encontrada para paymentId:", paymentId);
      return res.status(200).json({ received: true });
    }

    console.log("Reserva encontrada:", reservation.id, "Status atual:", reservation.status_pagamento);

    if (reservation.status_pagamento === "pago") {
      console.log("Reserva já estava paga, ignorando webhook.");
      return res.status(200).json({ received: true });
    }

    // Atualiza reserva como paga
    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update({
        status_pagamento: "pago",
        amount_paid: amountPaidCents / 100,
        status: "agendado",
      })
      .eq("id", reservation.id);

    if (updateError) {
      console.error("Erro ao atualizar reserva:", updateError);
    }

    // Credita saldo da arena (não bloqueia mesmo se falhar)
    try {
      const ABACATEPAY_FEE_CENTS = 80;
      await supabaseAdmin.rpc("increment_balance" as any, {
        p_user_id: reservation.user_id,
        p_amount_cents: Math.max(0, amountPaidCents - ABACATEPAY_FEE_CENTS),
      });

      // Registra transações no extrato
      await supabaseAdmin.from("transactions").insert([
        {
          user_id: reservation.user_id,
          amount_cents: amountPaidCents,
          type: "pix_payment",
          description: "Pagamento Pix",
          related_id: paymentId
        },
        {
          user_id: reservation.user_id,
          amount_cents: -ABACATEPAY_FEE_CENTS,
          type: "pix_fee",
          description: "Taxa da transação",
          related_id: paymentId
        }
      ]);
      console.log("Extrato atualizado");
    } catch (rpcError) {
      console.error("Erro no increment_balance ou transactions:", rpcError);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("payment-webhook error:", error);
    // Mesmo com erro interno retorna 200 para não gerar retentativa
    return res.status(200).json({ received: true, error: error.message });
  }
}
