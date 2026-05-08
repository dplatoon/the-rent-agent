import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, Check, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reminders")({
  head: () => ({
    meta: [
      { title: "Reminders — RentAgent.io" },
      { name: "description", content: "Follow-ups your agent set for you." },
    ],
  }),
  component: RemindersPage,
});

type Reminder = {
  id: string; title: string; notes: string | null;
  due_at: string; done: boolean; external_listing_id: string | null;
};

function RemindersPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate({ to: "/auth" }); return; }
    const { data, error } = await supabase
      .from("reminders").select("*").order("due_at", { ascending: true });
    if (error) toast.error(error.message);
    else setItems((data ?? []) as Reminder[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !due) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { error } = await supabase.from("reminders").insert({
      user_id: session.user.id,
      title: title.trim(),
      notes: notes.trim() || null,
      due_at: new Date(due).toISOString(),
    });
    if (error) { toast.error(error.message); return; }
    setTitle(""); setDue(""); setNotes("");
    toast.success("Reminder added");
    load();
  };

  const toggle = async (r: Reminder) => {
    const { error } = await supabase.from("reminders").update({ done: !r.done }).eq("id", r.id);
    if (error) toast.error(error.message);
    else setItems((x) => x.map((i) => i.id === r.id ? { ...i, done: !i.done } : i));
  };

  const del = async (id: string) => {
    const { error } = await supabase.from("reminders").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setItems((x) => x.filter((i) => i.id !== id));
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="font-mono text-[10px] tracking-[0.25em] text-primary mb-2">// FOLLOW-UPS</div>
      <h1 className="text-4xl font-display font-extrabold mb-2">Reminders</h1>
      <p className="text-muted-foreground mb-8">Tour follow-ups, application deadlines, anything you don't want to forget.</p>

      <form onSubmit={add} className="rounded-2xl border border-border bg-card p-5 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
          <Plus className="h-4 w-4 text-primary" /> NEW REMINDER
        </div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up with landlord on Oak St" required />
        <div className="grid sm:grid-cols-2 gap-2">
          <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" rows={1} />
        </div>
        <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">Add</Button>
      </form>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-16 text-center">
          <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No reminders yet.</p>
          <Link to="/imports" className="text-primary underline">Go to imports →</Link>
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((r) => (
            <div key={r.id} className={`rounded-xl border border-border bg-card p-4 flex items-center gap-3 ${r.done ? "opacity-50" : ""}`}>
              <button
                onClick={() => toggle(r)}
                className={`w-6 h-6 rounded border flex items-center justify-center ${r.done ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
                aria-label="Toggle done"
              >
                {r.done && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`font-medium ${r.done ? "line-through" : ""}`}>{r.title}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.due_at).toLocaleString()}
                  {r.notes && <> · {r.notes}</>}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
