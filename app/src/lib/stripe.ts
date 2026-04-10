import { API_URL } from "./api";

export async function redirectToCheckout(plan: "pro"): Promise<void> {
  const res = await fetch(`${API_URL}/stripe/create-checkout-session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
  window.location.href = data.url;
}

export async function redirectToBillingPortal(): Promise<void> {
  const res = await fetch(`${API_URL}/stripe/portal`, {
    method: "POST",
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to open billing portal");
  window.location.href = data.url;
}
