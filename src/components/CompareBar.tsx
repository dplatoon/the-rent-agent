import { useCompare } from "@/lib/compare-store";
import { CompareDialog } from "./CompareDialog";
import { Button } from "./ui/button";
import { GitCompare, X } from "lucide-react";
import { formatPrice } from "@/lib/listings";

export function CompareBar() {
  const items = useCompare((s) => s.items);
  const enabled = useCompare((s) => s.enabled);
  const remove = useCompare((s) => s.remove);
  const clear = useCompare((s) => s.clear);
  const open = useCompare((s) => s.dialogOpen);
  const setOpen = useCompare((s) => s.setDialogOpen);

  const showBar = enabled && items.length > 0;

  return (
    <>
      {showBar && (
        <div className="flex items-center gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary shrink-0 px-2">
            Compare · {items.length}
          </div>
          <div className="flex-1 flex gap-2 overflow-x-auto">
            {items.map((l) => (
              <div key={l.id} className="shrink-0 flex items-center gap-2 rounded-lg border border-border bg-background/50 pl-2 pr-1 py-1">
                <img src={l.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate max-w-[120px]">{l.neighborhood}</div>
                  <div className="text-[10px] text-muted-foreground">{formatPrice(l.price_monthly)}</div>
                </div>
                <button onClick={() => remove(l.id)} aria-label="Remove" className="p-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
          <Button
            size="sm"
            disabled={items.length < 2}
            onClick={() => setOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <GitCompare className="h-4 w-4 mr-1" /> Compare
          </Button>
        </div>
      </div>
      <CompareDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
