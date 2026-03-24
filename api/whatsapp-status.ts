import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Invalid token" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("uazapi_token")
    .eq("user_id", user.id)
    .single();

  if (!profile?.uazapi_token) {
    return res.status(200).json({ connected: false, status: "no_instance" });
  }

  const response = await fetch("https://genialchat.uazapi.com/instance/status", {
    method: "GET",
    headers: {
      Accept: "application/json",
      token: profile.uazapi_token,
    },
  });

  const result = await response.json();
  console.log("[whatsapp-status] raw response:", JSON.stringify(result));

  if (!response.ok) {
    return res.status(200).json({ connected: false, status: "error", raw: result });
  }

  // Estrutura correta da uazapi:
  // result.instance.status = "connected" | "connecting" | "disconnected"
  // result.status.connected = true | false
  // result.status.loggedIn = true | false
  const instanceStatus: string = result?.instance?.status ?? "";
  const statusConnected: boolean = result?.status?.connected === true;
  const statusLoggedIn: boolean = result?.status?.loggedIn === true;

  const connected = statusConnected || statusLoggedIn || instanceStatus === "connected";
  const state = instanceStatus || (connected ? "connected" : "disconnected");

  // Número do telefone
  const phone =
    result?.status?.jid ||
    result?.instance?.profileName ||
    null;

  return res.status(200).json({
    connected,
    status: state,
    phone,
    raw: result,
  });
}
