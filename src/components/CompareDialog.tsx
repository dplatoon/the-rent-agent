import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompare } from "@/lib/compare-store";
import { formatPrice, type Listing } from "@/lib/listings";
import { Bed, Bath, Maximize, PawPrint, Sofa, Check, X, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function CompareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const items = useCompare((s) => s.items);

  if (items.length === 0) return null;

  // Compute extremes for highlighting differences
  const prices = items.map((i) => i.price_monthly);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const sqfts = items.map((i) => i.sqft || 0).filter(Boolean);
  const maxSqft = sqfts.length ? Math.max(...sqfts) : 0;
  const maxBeds = Math.max(...items.map((i) => i.bedrooms));

  // Aggregate amenities for diffing
  const allAmenities = Array.from(new Set(items.flatMap((i) => i.amenities))).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Side-by-side comparison</DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-x-3">
            <thead>
              <tr>
                <th className="w-32"></th>
                {items.map((l) => (
                  <th key={l.id} className="text-left align-top min-w-[200px]">
                    <Link
                      to="/listings/$id"
                      params={{ id: l.id }}
                      className="block group"
                    >
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-elevated mb-3">
                        <img src={l.image_url} alt={l.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                      </div>
                      <div className="font-display font-bold text-base leading-tight line-clamp-2 group-hover:text-primary">{l.title}</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 inline -mt-0.5 mr-0.5" />{l.city}, {l.state}
                      </div>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              <Row label="Price" icon={null}>
                {items.map((l) => (
                  <Cell key={l.id} highlight={l.price_monthly === minPrice && minPrice !== maxPrice ? "best" : l.price_monthly === maxPrice && minPrice !== maxPrice ? "worst" : undefined}>
                    <span className="font-display font-bold text-lg">{formatPrice(l.price_monthly)}</span>
                    {l.price_monthly === minPrice && minPrice !== maxPrice && (
                      <div className="text-[10px] font-mono text-mint mt-0.5">CHEAPEST</div>
                    )}
                  </Cell>
                ))}
              </Row>
              <Row label="Bedrooms" icon={<Bed className="h-3.5 w-3.5" />}>
                {items.map((l) => (
                  <Cell key={l.id} highlight={l.bedrooms === maxBeds && items.some((x) => x.bedrooms !== maxBeds) ? "best" : undefined}>
                    {l.bedrooms || "Studio"}
                  </Cell>
                ))}
              </Row>
              <Row label="Bathrooms" icon={<Bath className="h-3.5 w-3.5" />}>
                {items.map((l) => <Cell key={l.id}>{l.bathrooms}</Cell>)}
              </Row>
              <Row label="Sq ft" icon={<Maximize className="h-3.5 w-3.5" />}>
                {items.map((l) => (
                  <Cell key={l.id} highlight={l.sqft === maxSqft && maxSqft > 0 && items.some((x) => (x.sqft || 0) !== maxSqft) ? "best" : undefined}>
                    {l.sqft ? `${l.sqft}` : "—"}
                  </Cell>
                ))}
              </Row>
              <Row label="$/sq ft" icon={null}>
                {items.map((l) => (
                  <Cell key={l.id}>
                    {l.sqft ? `$${(l.price_monthly / l.sqft).toFixed(2)}` : "—"}
                  </Cell>
                ))}
              </Row>
              <Row label="Pet-friendly" icon={<PawPrint className="h-3.5 w-3.5" />}>
                {items.map((l) => <Cell key={l.id}><BoolMark v={l.pet_friendly} /></Cell>)}
              </Row>
              <Row label="Furnished" icon={<Sofa className="h-3.5 w-3.5" />}>
                {items.map((l) => <Cell key={l.id}><BoolMark v={l.furnished} /></Cell>)}
              </Row>
              <Row label="Neighborhood" icon={null}>
                {items.map((l) => <Cell key={l.id}>{l.neighborhood}</Cell>)}
              </Row>
              <Row label="Available" icon={null}>
                {items.map((l) => (
                  <Cell key={l.id}>{l.available_from ? new Date(l.available_from).toLocaleDateString() : "Now"}</Cell>
                ))}
              </Row>

              {/* Amenities matrix */}
              <tr>
                <td colSpan={items.length + 1} className="pt-6 pb-2">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary">// AMENITIES</div>
                </td>
              </tr>
              {allAmenities.map((amenity) => (
                <Row key={amenity} label={amenity} icon={null}>
                  {items.map((l) => (
                    <Cell key={l.id}><BoolMark v={l.amenities.includes(amenity)} /></Cell>
                  ))}
                </Row>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border/30">
      <td className="py-2.5 align-top">
        <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {icon}{label}
        </span>
      </td>
      {children}
    </tr>
  );
}

function Cell({ children, highlight }: { children: React.ReactNode; highlight?: "best" | "worst" }) {
  return (
    <td className={`py-2.5 align-top ${highlight === "best" ? "text-mint" : highlight === "worst" ? "text-muted-foreground" : ""}`}>
      {children}
    </td>
  );
}

function BoolMark({ v }: { v: boolean }) {
  return v ? <Check className="h-4 w-4 text-mint" /> : <X className="h-4 w-4 text-muted-foreground/40" />;
}
