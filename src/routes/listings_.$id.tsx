import { createFileRoute, Link, useRouter, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, toggleSaved, type Listing } from "@/lib/listings";
import { fetchAgent, agentRouteParams } from "@/lib/agents";
import { useCompare, COMPARE_MAX } from "@/lib/compare-store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bed, Bath, Maximize, PawPrint, Sofa, Sparkles, Heart, GitCompare, Check,
  MapPin, Calendar, ArrowLeft, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/listings_/$id")({
  head: ({ loaderData }: { loaderData?: { listing: Listing } }) => {
    const l = loaderData?.listing;
    const title = l ? `${l.title} — ${l.city}, ${l.state}` : "Listing — RentAgent.io";
    const desc = l ? `${l.bedrooms || "Studio"} bed · ${l.bathrooms} bath · ${formatPrice(l.price_monthly)} in ${l.neighborhood}, ${l.city}.` : "Rental listing detail.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
    ];
    if (l?.image_url) {
      meta.push({ property: "og:image", content: l.image_url });
      meta.push({ name: "twitter:image", content: l.image_url });
    }
    return { meta };
  },
  loader: async ({ params }) => {
    const { data, error } = await supabase.from("listings").select("*").eq("id", params.id).maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return { listing: data as Listing };
  },
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-3">Couldn't load listing</h1>
        <p className="text-muted-foreground mb-6">{error.message}</p>
        <Button onClick={() => { router.invalidate(); reset(); }}>Retry</Button>
      </main>
    );
  },
  notFoundComponent: () => (
    <main className="max-w-3xl mx-auto px-6 py-20 text-center">
      <h1 className="font-display text-4xl font-bold mb-3">Listing not found</h1>
      <p className="text-muted-foreground mb-6">It may have been removed or relisted.</p>
      <Button asChild><Link to="/listings">Browse listings</Link></Button>
    </main>
  ),
  component: ListingDetail,
});

function ListingDetail() {
  const { listing } = Route.useLoaderData();
  const [agent, setAgent] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const compareEnabled = useCompare((s) => s.enabled);
  const setCompareEnabled = useCompare((s) => s.setEnabled);
  const compareItems = useCompare((s) => s.items);
  const toggleCompare = useCompare((s) => s.toggle);
  const isComparing = !!compareItems.find((x) => x.id === listing.id);

  useEffect(() => {
    (async () => {
      const a = await fetchAgent(listing.agent_id);
      setAgent(a);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data } = await supabase.from("saved_listings").select("listing_id")
          .eq("user_id", session.user.id).eq("listing_id", listing.id).maybeSingle();
        setSaved(!!data);
      }
    })();
  }, [listing.id, listing.agent_id]);

  const handleSave = async () => {
    if (!userId) { toast.error("Sign in to save listings"); return; }
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    try {
      await toggleSaved(userId, listing.id, saved);
      toast.success(next ? "Saved" : "Removed");
    } catch (err: any) {
      setSaved(!next);
      toast.error(err.message || "Failed");
    } finally { setBusy(false); }
  };

  const handleCompare = () => {
    if (!compareEnabled) setCompareEnabled(true);
    if (!isComparing && compareItems.length >= COMPARE_MAX) {
      toast.error(`Compare up to ${COMPARE_MAX} at a time`);
      return;
    }
    toggleCompare(listing);
    toast.success(isComparing ? "Removed from compare" : "Added to compare");
  };

  const pricePerSqft = listing.sqft ? (listing.price_monthly / listing.sqft).toFixed(2) : null;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link to="/listings" className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to listings
      </Link>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-elevated border border-border">
            <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
            {listing.is_featured && (
              <div className="absolute top-4 left-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/90 backdrop-blur text-primary-foreground text-[10px] font-mono uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Featured
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// {listing.neighborhood?.toUpperCase()}</div>
            <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tight">{listing.title}</h1>
            <div className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" /> {listing.city}, {listing.state}
            </div>
          </div>

          {listing.description && (
            <div className="mt-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">// About</div>
              <p className="text-base leading-relaxed text-foreground/90 whitespace-pre-line">{listing.description}</p>
            </div>
          )}

          {listing.amenities?.length > 0 && (
            <div className="mt-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">// Amenities</div>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {listing.amenities.map((a: string) => (
                  <li key={a} className="inline-flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-mint" /> {a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-6 sticky top-6">
            <div className="font-display text-4xl font-extrabold">{formatPrice(listing.price_monthly)}</div>
            {pricePerSqft && (
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">${pricePerSqft} / sq ft</div>
            )}

            <div className="grid grid-cols-3 gap-3 mt-6 text-sm">
              <Stat icon={<Bed className="h-4 w-4" />} label="Beds" value={listing.bedrooms || "Studio"} />
              <Stat icon={<Bath className="h-4 w-4" />} label="Baths" value={listing.bathrooms} />
              <Stat icon={<Maximize className="h-4 w-4" />} label="Sq ft" value={listing.sqft ?? "—"} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {listing.pet_friendly && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-mint/10 text-mint border border-mint/30">
                  <PawPrint className="h-3 w-3" /> Pet-friendly
                </span>
              )}
              {listing.furnished && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider bg-primary/10 text-primary border border-primary/30">
                  <Sofa className="h-3 w-3" /> Furnished
                </span>
              )}
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Available {listing.available_from ? new Date(listing.available_from).toLocaleDateString() : "now"}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button onClick={handleSave} variant={saved ? "default" : "outline"} className="w-full">
                <Heart className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                {saved ? "Saved" : "Save"}
              </Button>
              <Button onClick={handleCompare} variant={isComparing ? "default" : "outline"} className="w-full">
                {isComparing ? <Check className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
                {isComparing ? "Comparing" : "Compare"}
              </Button>
            </div>

            {agent && (
              <Link
                to="/agent/$state"
                params={agentRouteParams(agent)}
                className="mt-6 flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 transition group"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: agent.color }}>
                  {agent.avatar_emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-bold text-sm group-hover:text-primary truncate">{agent.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{agent.state} · {agent.specialty}</div>
                </div>
                <MessageCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </Link>
            )}
            {!agent && <Skeleton className="mt-6 h-16 rounded-xl" />}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="mt-1 font-display font-bold text-lg leading-none">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
