import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { fetchSharedImport, SOURCE_META, type ExternalListing, type ExternalSource } from "@/lib/external-listings";
import { ExternalLink, Copy, Check, Bed, Bath, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/imports/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared Listing — RentAgent.io" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { token } = Route.useParams();
  const [item, setItem] = useState<ExternalListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchSharedImport(token).then((r) => { setItem(r); setLoading(false); });
  }, [token]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  if (loading) return <main className="p-12 text-center text-muted-foreground">Loading…</main>;
  if (!item) {
    return (
      <main className="max-w-xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Link expired or invalid</h1>
        <p className="text-muted-foreground mb-6">This shared listing isn't available.</p>
        <Link to="/" className="text-primary underline">Go home</Link>
      </main>
    );
  }

  const src = SOURCE_META[(item.source as ExternalSource) || "other"];

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] tracking-[0.25em] text-primary">// SHARED LISTING</div>
        <Button size="sm" variant="outline" onClick={copyLink}>
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="font-mono text-[11px] px-2 py-0.5 rounded" style={{ background: `${src.color}22`, color: src.color }}>
            {src.label}
          </span>
          {item.price_monthly && <span className="font-bold text-lg">${item.price_monthly.toLocaleString()}/mo</span>}
        </div>
        <h1 className="text-2xl font-bold mb-2">{item.title || "Listing"}</h1>
        {item.location && (
          <p className="text-muted-foreground mb-3 inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {item.location}
          </p>
        )}
        {(item.bedrooms != null || item.bathrooms != null) && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            {item.bedrooms != null && <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" /> {item.bedrooms} bd</span>}
            {item.bathrooms != null && <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" /> {item.bathrooms} ba</span>}
          </div>
        )}
        {item.notes && <p className="text-sm bg-elevated/50 rounded-lg p-3 mb-4 whitespace-pre-wrap">{item.notes}</p>}
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
          View original on {src.label} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">
        Shared via <Link to="/" className="text-primary hover:underline">RentAgent.io</Link>
      </p>
    </main>
  );
}
