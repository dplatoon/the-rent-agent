import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { draftAgentMessage } from "@/lib/agent-draft.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  detectSource, isSafeHttpUrl, listImports, SOURCE_META,
  type ExternalListing, type ExternalSource,
} from "@/lib/external-listings";
import {
  ExternalLink, Trash2, Share2, Plus, Sparkles, Calendar, Mail, FileText, GitCompare,
  Copy, EyeOff, Eye, Clock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/imports")({
  head: () => ({
    meta: [
      { title: "Imported Listings — RentAgent.io" },
      { name: "description", content: "Save listings from Zillow, Apartments.com, Craigslist, and more. Get AI help drafting tour requests and applications." },
    ],
  }),
  component: ImportsPage,
});

type DraftKind = "tour" | "application" | "compare";

function ImportsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExternalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [draftOpen, setDraftOpen] = useState<null | DraftKind>(null);
  const [draftText, setDraftText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [shareItem, setShareItem] = useState<ExternalListing | null>(null);
  const [shareExpiry, setShareExpiry] = useState<string>("never");
  const [shareMask, setShareMask] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  const openShare = (l: ExternalListing) => {
    setShareItem(l);
    setShareMask(l.share_mask_sensitive);
    if (!l.share_expires_at) setShareExpiry("never");
    else {
      const ms = new Date(l.share_expires_at).getTime() - Date.now();
      if (ms <= 1.5 * 3600e3) setShareExpiry("1h");
      else if (ms <= 1.5 * 24 * 3600e3) setShareExpiry("24h");
      else if (ms <= 1.5 * 7 * 24 * 3600e3) setShareExpiry("7d");
      else setShareExpiry("30d");
    }
  };

  const expiryToDate = (v: string): string | null => {
    const map: Record<string, number> = { "1h": 3600e3, "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3, "30d": 30 * 24 * 3600e3 };
    if (v === "never" || !map[v]) return null;
    return new Date(Date.now() + map[v]).toISOString();
  };

  const saveShareSettings = async () => {
    if (!shareItem) return;
    setSavingShare(true);
    const share_expires_at = expiryToDate(shareExpiry);
    const { error } = await supabase
      .from("external_listings")
      .update({ share_expires_at, share_mask_sensitive: shareMask })
      .eq("id", shareItem.id);
    setSavingShare(false);
    if (error) { toast.error(error.message); return; }
    setItems((xs) => xs.map((x) => x.id === shareItem.id ? { ...x, share_expires_at, share_mask_sensitive: shareMask } : x));
    setShareItem((s) => s ? { ...s, share_expires_at, share_mask_sensitive: shareMask } : s);
    toast.success("Share settings updated");
  };

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate({ to: "/auth" }); return; }
    try { setItems(await listImports()); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    if (!isSafeHttpUrl(url)) { toast.error("Enter a valid http(s) URL"); return; }
    setAdding(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate({ to: "/auth" }); return; }
    const source = detectSource(url);
    const { error } = await supabase.from("external_listings").insert({
      user_id: session.user.id,
      url: url.trim(),
      source,
      title: title.trim() || null,
      price_monthly: price ? parseInt(price, 10) : null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    });
    setAdding(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Saved from ${SOURCE_META[source].label}`);
    setUrl(""); setTitle(""); setPrice(""); setLocation(""); setNotes("");
    load();
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("external_listings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removed"); setItems((x) => x.filter((i) => i.id !== id)); }
  };

  const copyShare = async (token: string) => {
    const link = `${window.location.origin}/imports/share/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Share link copied");
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < 4) n.add(id);
      else toast.error("Pick up to 4");
      return n;
    });
  };

  const runDraft = async (kind: DraftKind) => {
    const ids = [...selected];
    if (ids.length === 0) { toast.error("Select at least one listing"); return; }
    if (kind === "compare" && ids.length < 2) { toast.error("Pick 2-4 to compare"); return; }
    setDraftOpen(kind); setDraftText(""); setDrafting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/auth" }); return; }
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-draft`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ kind, listing_ids: ids }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (r.status === 429) toast.error("Rate limited. Try again shortly.");
        else if (r.status === 402) toast.error("AI credits exhausted.");
        else toast.error(j.error || "Failed");
        setDraftOpen(null);
        return;
      }
      setDraftText(j.text || "");
    } catch (e: any) {
      toast.error(e.message); setDraftOpen(null);
    } finally { setDrafting(false); }
  };

  const copyDraft = async () => {
    await navigator.clipboard.writeText(draftText);
    toast.success("Copied to clipboard");
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// IMPORTS</div>
      <h1 className="text-4xl md:text-5xl font-display font-extrabold mb-2">Bring listings from anywhere</h1>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Paste a link from Zillow, Apartments.com, Rent.com, Craigslist, Facebook Marketplace, Trulia, Redfin, HotPads, or Realtor.com. Your agent can then draft tour requests, application letters, and compare them for you.
      </p>

      {/* Add form */}
      <form onSubmit={add} className="rounded-2xl border border-border bg-card p-5 mb-8 space-y-3">
        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
          <Plus className="h-4 w-4 text-primary" /> ADD LISTING
        </div>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.zillow.com/homedetails/..."
          required
          className="h-11"
        />
        <div className="grid sm:grid-cols-3 gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" />
          <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="Price /mo" inputMode="numeric" />
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Neighborhood / city" />
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional) — e.g. 'pet-friendly, contacted Tue'" rows={2} />
        <div className="flex items-center justify-between">
          {url && (
            <span className="text-xs font-mono text-muted-foreground">
              Detected: <span style={{ color: SOURCE_META[detectSource(url)].color }}>{SOURCE_META[detectSource(url)].label}</span>
            </span>
          )}
          <Button type="submit" disabled={adding || !url} className="ml-auto bg-primary text-primary-foreground hover:bg-primary/90">
            {adding ? "Saving…" : "Save listing"}
          </Button>
        </div>
      </form>

      {/* Quick actions bar */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-elevated/50 p-3 mb-6 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-mono text-primary mr-2">
            <Sparkles className="h-4 w-4" /> AGENT ACTIONS
          </div>
          <span className="text-xs text-muted-foreground mr-2">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => runDraft("tour")} disabled={selected.size === 0}>
            <Mail className="h-3 w-3" /> Tour message
          </Button>
          <Button size="sm" variant="outline" onClick={() => runDraft("application")} disabled={selected.size === 0}>
            <FileText className="h-3 w-3" /> Application letter
          </Button>
          <Button size="sm" variant="outline" onClick={() => runDraft("compare")} disabled={selected.size < 2}>
            <GitCompare className="h-3 w-3" /> Compare
          </Button>
          <Link to="/reminders" className="ml-auto">
            <Button size="sm" variant="ghost"><Calendar className="h-3 w-3" /> Reminders</Button>
          </Link>
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <ExternalLink className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No imports yet. Paste a listing URL above to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((l) => {
            const src = SOURCE_META[(l.source as ExternalSource) || "other"];
            const sel = selected.has(l.id);
            return (
              <div
                key={l.id}
                className={`rounded-xl border bg-card p-4 transition flex flex-col sm:flex-row gap-3 ${sel ? "border-primary/60 ring-1 ring-primary/40" : "border-border hover:border-primary/30"}`}
              >
                <button
                  onClick={() => toggle(l.id)}
                  className={`shrink-0 w-5 h-5 rounded border self-start mt-1 flex items-center justify-center ${sel ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
                  aria-label={sel ? "Deselect" : "Select"}
                >
                  {sel && <span className="text-[10px]">✓</span>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${src.color}22`, color: src.color }}>
                      {src.label}
                    </span>
                    {l.price_monthly && <span className="font-bold">${l.price_monthly.toLocaleString()}/mo</span>}
                    {l.location && <span className="text-xs text-muted-foreground truncate">· {l.location}</span>}
                    {l.share_mask_sensitive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5" title="Sensitive details hidden on share">
                        <EyeOff className="h-2.5 w-2.5" /> MASKED
                      </span>
                    )}
                    {l.share_expires_at && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5" title={`Share expires ${new Date(l.share_expires_at).toLocaleString()}`}>
                        <Clock className="h-2.5 w-2.5" /> EXPIRES
                      </span>
                    )}
                  </div>
                  <div className="font-medium truncate">{l.title || l.url}</div>
                  {l.notes && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.notes}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost"><ExternalLink className="h-3 w-3" /></Button>
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => openShare(l)} title="Share settings">
                    <Share2 className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => del(l.id)} title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Draft modal */}
      {draftOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDraftOpen(null)}>
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <div className="font-mono text-[10px] text-primary tracking-[0.2em]">// AGENT DRAFT</div>
                <h2 className="font-bold text-lg capitalize">
                  {draftOpen === "tour" && "Tour request message"}
                  {draftOpen === "application" && "Application cover letter"}
                  {draftOpen === "compare" && "Listing comparison"}
                </h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDraftOpen(null)}>Close</Button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {drafting ? (
                <div className="text-muted-foreground text-sm">✨ Drafting…</div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{draftText}</pre>
              )}
            </div>
            {!drafting && draftText && (
              <div className="p-4 border-t border-border flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={copyDraft}>Copy</Button>
                {draftOpen !== "compare" && (
                  <a href={`mailto:?subject=${encodeURIComponent(draftOpen === "tour" ? "Tour inquiry" : "Rental application")}&body=${encodeURIComponent(draftText)}`}>
                    <Button size="sm" className="bg-primary text-primary-foreground">Open in email</Button>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Share settings dialog */}
      <Dialog open={!!shareItem} onOpenChange={(o) => !o && setShareItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Share2 className="h-4 w-4 text-primary" /> Share listing</DialogTitle>
            <DialogDescription>
              Anyone with the link can view this listing. Set an expiration and choose what's visible.
            </DialogDescription>
          </DialogHeader>

          {shareItem && (
            <div className="space-y-4">
              {/* Link */}
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/imports/share/${shareItem.share_token}`}
                  className="font-mono text-xs"
                />
                <Button size="sm" variant="outline" onClick={() => copyShare(shareItem.share_token)}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>

              {/* Expiry */}
              <div>
                <Label className="text-xs font-mono text-muted-foreground tracking-wider inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> EXPIRES
                </Label>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { v: "1h", l: "1 hour" },
                    { v: "24h", l: "24 hours" },
                    { v: "7d", l: "7 days" },
                    { v: "30d", l: "30 days" },
                    { v: "never", l: "Never" },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setShareExpiry(o.v)}
                      className={`text-xs px-2.5 py-1 rounded border transition ${shareExpiry === o.v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                {shareItem.share_expires_at && (
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    Currently expires {new Date(shareItem.share_expires_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Mask sensitive */}
              <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                <div className="flex-1">
                  <Label htmlFor="mask-toggle" className="font-medium inline-flex items-center gap-1.5">
                    {shareMask ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    Hide sensitive details
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hides notes, the original listing URL, and reduces the address to city only.
                  </p>
                </div>
                <Switch id="mask-toggle" checked={shareMask} onCheckedChange={setShareMask} />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setShareItem(null)}>Cancel</Button>
                <Button size="sm" onClick={saveShareSettings} disabled={savingShare} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {savingShare ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
