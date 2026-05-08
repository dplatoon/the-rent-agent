import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ListingCard } from "@/components/ListingCard";
import type { Listing } from "@/lib/listings";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saved")({
  head: () => ({
    meta: [
      { title: "Your Saved Rentals — RentAgent.io" },
      { name: "description", content: "Listings you've bookmarked." },
    ],
  }),
  component: SavedPage,
});

function SavedPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate({ to: "/auth" }); return; }
    const { data } = await supabase
      .from("saved_listings")
      .select("listing_id, listings(*)")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    setItems(((data ?? []).map((r: any) => r.listings).filter(Boolean)) as Listing[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// YOUR LIBRARY</div>
      <h1 className="text-4xl md:text-5xl font-display font-extrabold mb-2">Saved listings</h1>
      <p className="text-muted-foreground mb-8">{items.length} bookmarked.</p>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <Heart className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">Nothing saved yet.</p>
          <Link to="/listings" className="text-primary underline">Browse listings →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((l) => <ListingCard key={l.id} listing={l} saved onChange={load} />)}
        </div>
      )}
    </main>
  );
}
