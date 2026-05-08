import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { fetchListings, fetchSavedIds, type Listing } from "@/lib/listings";
import { fetchRentcastListings, type RentcastListing } from "@/lib/rentcast";
import { fetchAgents } from "@/lib/agents";
import { ListingCard } from "@/components/ListingCard";
import { RentCastCard } from "@/components/RentCastCard";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Search, ChevronLeft, ChevronRight, GitCompare, Radio } from "lucide-react";
import { useCompare } from "@/lib/compare-store";

const SORTS = ["featured", "price-asc", "price-desc", "beds-desc", "newest"] as const;
type Sort = (typeof SORTS)[number];

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  state: fallback(z.string(), "").default(""),
  beds: fallback(z.number(), 0).default(0),
  maxPrice: fallback(z.number(), 0).default(0),
  pets: fallback(z.boolean(), false).default(false),
  furnished: fallback(z.boolean(), false).default(false),
  sort: fallback(z.enum(SORTS), "featured").default("featured"),
  page: fallback(z.number().int().min(1), 1).default(1),
  perPage: fallback(z.number().int().min(6).max(48), 12).default(12),
  source: fallback(z.enum(["curated", "live"]), "curated").default("curated"),
});

export const Route = createFileRoute("/listings")({
  head: () => ({
    meta: [
      { title: "Browse Rentals — RentAgent.io" },
      { name: "description", content: "Filter, sort, and paginate hand-picked rentals from your local AI agents." },
      { property: "og:title", content: "Browse Rentals — RentAgent.io" },
      { property: "og:description", content: "Hand-curated rentals across all 50 states." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  component: ListingsPage,
});

function ListingsPage() {
  const navigate = useNavigate({ from: "/listings" });
  const search = Route.useSearch();
  const { q, state, beds, maxPrice, pets, furnished, sort, page, perPage, source } = search;

  const [listings, setListings] = useState<Listing[]>([]);
  const [liveListings, setLiveListings] = useState<RentcastListing[]>([]);
  const [agents, setAgents] = useState<{ id: string; state: string }[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [list, ags, live] = await Promise.all([
        fetchListings(),
        fetchAgents(),
        fetchRentcastListings({ limit: 200 }).catch(() => []),
      ]);
      setListings(list);
      setLiveListings(live);
      setAgents(ags as any);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setSaved(await fetchSavedIds(session.user.id));
      setLoading(false);
    })();
  }, []);

  const update = (patch: Partial<typeof search>) => {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch, page: patch.page ?? 1 }) });
  };

  const filtered = useMemo(() => {
    let out = listings.filter((l) => {
      if (state && l.state !== state) return false;
      if (beds && l.bedrooms < beds) return false;
      if (maxPrice && l.price_monthly > maxPrice) return false;
      if (pets && !l.pet_friendly) return false;
      if (furnished && !l.furnished) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!`${l.title} ${l.neighborhood} ${l.city}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "price-asc": return a.price_monthly - b.price_monthly;
        case "price-desc": return b.price_monthly - a.price_monthly;
        case "beds-desc": return b.bedrooms - a.bedrooms;
        case "newest": return +new Date(b.created_at) - +new Date(a.created_at);
        case "featured":
        default:
          return (Number(b.is_featured) - Number(a.is_featured)) || (+new Date(b.created_at) - +new Date(a.created_at));
      }
    });
    return out;
  }, [listings, state, beds, maxPrice, pets, furnished, q, sort]);

  const liveFiltered = useMemo(() => {
    return liveListings.filter((l) => {
      if (state && (l.state || "").toUpperCase() !== state.toUpperCase()) return false;
      if (beds && (l.bedrooms ?? 0) < beds) return false;
      if (maxPrice && (l.price ?? 0) > maxPrice) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!`${l.address ?? ""} ${l.city ?? ""} ${l.zip ?? ""}`.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [liveListings, state, beds, maxPrice, q]);

  const isLive = source === "live";
  const total = isLive ? liveFiltered.length : filtered.length;
  const sourceTotal = isLive ? liveListings.length : listings.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);
  const livePageItems = liveFiltered.slice(start, start + perPage);

  const clearAll = () => navigate({ search: () => ({ q: "", state: "", beds: 0, maxPrice: 0, pets: false, furnished: false, sort: "featured" as Sort, page: 1, perPage: 12, source }) });
  const hasFilters = q || state || beds || maxPrice || pets || furnished;

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// THE LIBRARY</div>
          <h1 className="text-4xl md:text-6xl font-display font-extrabold tracking-tight">
            Listings, hand-curated.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            {total} of {sourceTotal} homes match. Page {safePage} of {totalPages}.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border p-1 bg-card/50">
          <button
            onClick={() => update({ source: "curated" })}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition ${!isLive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Curated
          </button>
          <button
            onClick={() => update({ source: "live" })}
            className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-medium transition ${isLive ? "bg-mint text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Radio className="h-3 w-3" /> Live Market
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl border border-border bg-card/50 backdrop-blur p-4 mb-4 grid md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => update({ q: e.target.value })} placeholder="Search neighborhood, city…" className="pl-9 h-11" />
        </div>
        <select value={state} onChange={(e) => update({ state: e.target.value })}
          className="md:col-span-2 h-11 rounded-md bg-transparent border border-input px-3 text-sm">
          <option value="">All states</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.state}</option>)}
        </select>
        <select value={beds} onChange={(e) => update({ beds: Number(e.target.value) })}
          className="md:col-span-2 h-11 rounded-md bg-transparent border border-input px-3 text-sm">
          <option value={0}>Any beds</option>
          <option value={1}>1+ bed</option>
          <option value={2}>2+ beds</option>
          <option value={3}>3+ beds</option>
          <option value={4}>4+ beds</option>
        </select>
        <select value={maxPrice} onChange={(e) => update({ maxPrice: Number(e.target.value) })}
          className="md:col-span-2 h-11 rounded-md bg-transparent border border-input px-3 text-sm">
          <option value={0}>Any price</option>
          <option value={2000}>≤ $2k</option>
          <option value={3000}>≤ $3k</option>
          <option value={4000}>≤ $4k</option>
          <option value={6000}>≤ $6k</option>
        </select>
        <div className="md:col-span-2 flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={pets} onChange={(e) => update({ pets: e.target.checked })} className="accent-primary" />
            Pets
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={furnished} onChange={(e) => update({ furnished: e.target.checked })} className="accent-primary" />
            Furnished
          </label>
        </div>
      </div>

      {/* Sort + per-page bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Sort</span>
          {([
            ["featured", "Featured"],
            ["price-asc", "Price ↑"],
            ["price-desc", "Price ↓"],
            ["beds-desc", "Most beds"],
            ["newest", "Newest"],
          ] as [Sort, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => update({ sort: key })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                sort === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <CompareToggle />
          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground underline">
              Clear filters
            </button>
          )}
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Per page
            <select value={perPage} onChange={(e) => update({ perPage: Number(e.target.value) })}
              className="h-9 rounded-md bg-transparent border border-input px-2 text-xs">
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </label>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : (isLive ? livePageItems.length === 0 : pageItems.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            {isLive ? "No live listings match yet. Try a different state or loosen filters." : "No listings match. Loosen those filters."}
          </p>
          <Button variant="outline" className="mt-4" onClick={clearAll}>Clear filters</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLive
              ? livePageItems.map((l) => <RentCastCard key={l.id} listing={l} />)
              : pageItems.map((l) => <ListingCard key={l.id} listing={l} saved={saved.has(l.id)} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 1}
                onClick={() => update({ page: safePage - 1 })}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              {pageNumbers(safePage, totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`e${i}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => update({ page: n })}
                    className={`min-w-9 h-9 px-3 rounded-md text-sm font-medium border transition ${
                      n === safePage
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                    aria-current={n === safePage ? "page" : undefined}
                  >
                    {n}
                  </button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === totalPages}
                onClick={() => update({ page: safePage + 1 })}
                aria-label="Next page"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Looking for something specific? <Link to="/map" className="text-primary underline">Ask an agent →</Link>
      </p>
    </main>
  );
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  const window = 1;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - window && i <= current + window)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }
  return pages;
}

function CompareToggle() {
  const enabled = useCompare((s) => s.enabled);
  const setEnabled = useCompare((s) => s.setEnabled);
  const count = useCompare((s) => s.items.length);
  return (
    <button
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        enabled ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
      }`}
    >
      <GitCompare className="h-3.5 w-3.5" />
      Compare {count > 0 && `(${count})`}
    </button>
  );
}
