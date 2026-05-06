import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchListings, fetchSavedIds, type Listing } from "@/lib/listings";
import { fetchAgents } from "@/lib/agents";
import { ListingCard } from "@/components/ListingCard";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Search } from "lucide-react";

export const Route = createFileRoute("/listings")({
  head: () => ({
    meta: [
      { title: "Browse Rentals — RentAgent.io" },
      { name: "description", content: "Hand-picked rental listings curated by your local AI agents." },
      { property: "og:title", content: "Browse Rentals — RentAgent.io" },
      { property: "og:description", content: "Hand-picked rentals across all 50 states." },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [agents, setAgents] = useState<{ id: string; state: string; color: string; name: string }[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [stateFilter, setStateFilter] = useState<string>("");
  const [bedrooms, setBedrooms] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [petsOnly, setPetsOnly] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [list, ags] = await Promise.all([fetchListings(), fetchAgents()]);
      setListings(list);
      setAgents(ags as any);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setSaved(await fetchSavedIds(session.user.id));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (stateFilter && l.state !== stateFilter) return false;
      if (bedrooms !== "" && l.bedrooms < Number(bedrooms)) return false;
      if (maxPrice !== "" && l.price_monthly > Number(maxPrice)) return false;
      if (petsOnly && !l.pet_friendly) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!`${l.title} ${l.neighborhood} ${l.city}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [listings, stateFilter, bedrooms, maxPrice, petsOnly, query]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// THE LIBRARY</div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight">
            Listings, hand-curated.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {filtered.length} of {listings.length} homes. Pulled from every agent's territory.
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur p-4 mb-8 grid md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search neighborhood, city…" className="pl-9 h-11" />
        </div>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
          className="md:col-span-2 h-11 rounded-md bg-transparent border border-input px-3 text-sm">
          <option value="">All states</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.state}</option>)}
        </select>
        <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value === "" ? "" : Number(e.target.value))}
          className="md:col-span-2 h-11 rounded-md bg-transparent border border-input px-3 text-sm">
          <option value="">Any beds</option>
          <option value="0">Studio+</option>
          <option value="1">1+ bed</option>
          <option value="2">2+ beds</option>
          <option value="3">3+ beds</option>
        </select>
        <select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
          className="md:col-span-2 h-11 rounded-md bg-transparent border border-input px-3 text-sm">
          <option value="">Any price</option>
          <option value="2000">≤ $2k</option>
          <option value="3000">≤ $3k</option>
          <option value="4000">≤ $4k</option>
          <option value="6000">≤ $6k</option>
        </select>
        <label className="md:col-span-2 inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={petsOnly} onChange={(e) => setPetsOnly(e.target.checked)} className="accent-primary" />
          Pet-friendly
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No listings match. Loosen those filters.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setStateFilter(""); setBedrooms(""); setMaxPrice(""); setPetsOnly(false); setQuery(""); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} saved={saved.has(l.id)} />
          ))}
        </div>
      )}
    </main>
  );
}
