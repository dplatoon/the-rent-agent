import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — RentAgent.io" }] }),
  component: Pricing,
});

type Tier = {
  name: string;
  price: string;
  desc: string;
  features: string[];
  cta: string;
  highlight?: boolean;
  plan?: "pro" | "premium"; // set => paid plan that triggers checkout
};

const tiers: Tier[] = [
  { name: "Free", price: "$0", desc: "Try every agent.", features: ["5 chats/day", "All 12 agents", "Basic search"], cta: "Get started" },
  { name: "Pro", price: "$9", highlight: true, plan: "pro", desc: "Serious renters.", features: ["Unlimited chats", "Saved conversations", "Daily alerts", "PDF rental reports"], cta: "Go Pro" },
  { name: "Premium", price: "$19", plan: "premium", desc: "White-glove search.", features: ["Everything in Pro", "Early-access listings", "Lease negotiation drafts", "Priority support"], cta: "Get Premium" },
];

function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  async function startCheckout(plan: "pro" | "premium") {
    setLoading(plan);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not signed in — send them to auth first, then they can pick a plan.
        toast.info("Please sign in to upgrade.");
        navigate({ to: "/auth" });
        return;
      }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier: plan }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.url) {
        toast.error(data.error === "forbidden" ? "Checkout unavailable from this origin." : "Could not start checkout. Try again.");
        return;
      }
      window.location.href = data.url; // hosted Stripe Checkout
    } catch (e: any) {
      toast.error(e?.message || "Network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// PRICING</div>
        <h1 className="text-4xl md:text-5xl font-bold">Simple plans. Real value.</h1>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((t) => (
          <div key={t.name}
               className={`rounded-2xl border p-6 ${t.highlight ? "border-primary/40 bg-card glow-cyan" : "border-border bg-card"}`}>
            <div className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground mb-2">{t.name.toUpperCase()}</div>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold">{t.price}</span>
              <span className="text-sm text-muted-foreground">/mo</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{t.desc}</p>
            <ul className="space-y-2 mb-6">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            {t.plan ? (
              <Button
                className={`w-full ${t.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`}
                variant={t.highlight ? "default" : "outline"}
                disabled={loading !== null}
                onClick={() => startCheckout(t.plan!)}
              >
                {loading === t.plan ? "Starting…" : t.cta}
              </Button>
            ) : (
              <Link to="/auth">
                <Button className="w-full" variant="outline">{t.cta}</Button>
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">
        Secure payment via Stripe. Cancel anytime.
      </p>
    </main>
  );
}
