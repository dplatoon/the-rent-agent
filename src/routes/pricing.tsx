import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — RentAgent.io" }] }),
  component: Pricing,
});

const tiers = [
  { name: "Free", price: "$0", desc: "Try every agent.", features: ["5 chats/day", "All 12 agents", "Basic search"], cta: "Get started", to: "/auth" },
  { name: "Pro", price: "$9", highlight: true, desc: "Serious renters.", features: ["Unlimited chats", "Saved conversations", "Daily alerts", "PDF rental reports"], cta: "Go Pro", to: "/auth" },
  { name: "Premium", price: "$19", desc: "White-glove search.", features: ["Everything in Pro", "Early-access listings", "Lease negotiation drafts", "Priority support"], cta: "Get Premium", to: "/auth" },
];

function Pricing() {
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
            <Link to={t.to}>
              <Button className={`w-full ${t.highlight ? "bg-primary text-primary-foreground hover:bg-primary/90" : ""}`} variant={t.highlight ? "default" : "outline"}>
                {t.cta}
              </Button>
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
