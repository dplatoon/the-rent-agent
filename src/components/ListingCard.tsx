import { Link } from "@tanstack/react-router";
import { Heart, Bed, Bath, Maximize, PawPrint, Sparkles, Check, GitCompare } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toggleSaved, formatPrice, type Listing } from "@/lib/listings";
import { useCompare, COMPARE_MAX } from "@/lib/compare-store";
import { toast } from "sonner";

export function ListingCard({ listing, saved = false, onChange }: { listing: Listing; saved?: boolean; onChange?: () => void }) {
  const [isSaved, setIsSaved] = useState(saved);
  const [busy, setBusy] = useState(false);
  const compareEnabled = useCompare((s) => s.enabled);
  const compareItems = useCompare((s) => s.items);
  const toggleCompare = useCompare((s) => s.toggle);
  const isComparing = !!compareItems.find((x) => x.id === listing.id);

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error("Sign in to save listings"); setBusy(false); return; }
    const next = !isSaved;
    setIsSaved(next);
    try {
      await toggleSaved(session.user.id, listing.id, isSaved);
      toast.success(next ? "Saved" : "Removed");
      onChange?.();
    } catch (err: any) {
      setIsSaved(!next);
      toast.error(err.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isComparing && compareItems.length >= COMPARE_MAX) {
      toast.error(`Compare up to ${COMPARE_MAX} at a time`);
      return;
    }
    toggleCompare(listing);
  };

  return (
    <Link
      to="/agent/$state"
      params={{ state: listing.agent_id.toLowerCase() }}
      className={`group relative block rounded-2xl overflow-hidden border bg-card transition hover:-translate-y-1 hover:shadow-2xl ${
        isComparing ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-elevated">
        <img
          src={listing.image_url}
          alt={listing.title}
          loading="lazy"
          className="w-full h-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {listing.is_featured && (
          <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/90 backdrop-blur text-primary-foreground text-[10px] font-mono uppercase tracking-wider">
            <Sparkles className="h-3 w-3" /> Featured
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            onClick={handleSave}
            aria-label={isSaved ? "Remove from saved" : "Save listing"}
            className="w-9 h-9 rounded-full bg-background/70 backdrop-blur flex items-center justify-center hover:bg-background transition"
          >
            <Heart className={`h-4 w-4 transition ${isSaved ? "fill-pink text-pink" : "text-foreground"}`} />
          </button>
          {compareEnabled && (
            <button
              onClick={handleCompare}
              aria-label={isComparing ? "Remove from compare" : "Add to compare"}
              aria-pressed={isComparing}
              className={`w-9 h-9 rounded-full backdrop-blur flex items-center justify-center transition ${
                isComparing ? "bg-primary text-primary-foreground" : "bg-background/70 hover:bg-background"
              }`}
            >
              {isComparing ? <Check className="h-4 w-4" /> : <GitCompare className="h-4 w-4" />}
            </button>
          )}
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">{listing.neighborhood}</div>
            <div className="font-display font-bold text-xl text-white truncate">{formatPrice(listing.price_monthly)}</div>
          </div>
          <div className="font-mono text-[10px] text-white/80 uppercase">{listing.city}, {listing.state}</div>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-display font-bold text-base leading-tight line-clamp-1">{listing.title}</h3>
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{listing.bedrooms || "Studio"}</span>
          <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{listing.bathrooms}</span>
          {listing.sqft && <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{listing.sqft} ft²</span>}
          {listing.pet_friendly && <span className="inline-flex items-center gap-1 text-mint"><PawPrint className="h-3.5 w-3.5" /></span>}
        </div>
      </div>
    </Link>
  );
}
