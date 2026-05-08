import { Bed, Bath, Maximize, MapPin, Radio } from "lucide-react";
import type { RentcastListing } from "@/lib/rentcast";

function formatPrice(n: number | null) {
  if (!n) return "—";
  return `$${n.toLocaleString()}/mo`;
}

export function RentCastCard({ listing }: { listing: RentcastListing }) {
  return (
    <div className="group relative rounded-2xl overflow-hidden border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-mint inline-flex items-center gap-1">
            <Radio className="h-3 w-3" /> Live · RentCast
          </div>
          <div className="mt-1 font-display font-bold text-xl">{formatPrice(listing.price)}</div>
          <div className="mt-1 text-sm text-foreground/90 line-clamp-1">{listing.address || "Address unavailable"}</div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {[listing.city, listing.state, listing.zip].filter(Boolean).join(", ")}
          </div>
        </div>
        {listing.property_type && (
          <span className="shrink-0 rounded-full border border-border px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {listing.property_type}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{listing.bedrooms ?? "—"}</span>
        <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{listing.bathrooms ?? "—"}</span>
        {listing.sqft && (
          <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{listing.sqft} ft²</span>
        )}
      </div>
    </div>
  );
}
