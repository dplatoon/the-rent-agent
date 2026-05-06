import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — RentAgent.io" }] }),
  component: About,
});

function About() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// THE STORY</div>
      <h1 className="text-4xl md:text-5xl font-bold mb-6">Renting shouldn't feel like a scam hunt.</h1>
      <div className="space-y-5 text-muted-foreground leading-relaxed">
        <p>We grew up on Craigslist, lost deposits to ghost landlords, and burned weekends scrolling Zillow. We built RentAgent because the rental market deserves a guide — not another algorithm.</p>
        <p>Each of our 50 AI agents is hand-tuned to a US state. They don't replace humans — they do the homework so you can focus on the choice that matters: where you'll live next.</p>
        <p>Cyan and violet, by the way, are the colors of clear water and twilight. We thought your home search should feel like both.</p>
      </div>
    </main>
  );
}
