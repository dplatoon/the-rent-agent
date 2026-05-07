import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InstallButton } from "@/components/InstallButton";

export function SiteHeader() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-violet glow-cyan flex items-center justify-center font-mono font-bold text-primary-foreground">
            R
          </div>
          <div className="leading-tight">
            <div className="font-bold text-lg tracking-tight">RentAgent<span className="text-primary">.io</span></div>
            <div className="font-mono text-[9px] text-muted-foreground tracking-[0.2em] uppercase">AI Rental Intelligence</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <Link to="/listings" className="hover:text-primary transition" activeProps={{ className: "text-primary" }}>Listings</Link>
          <Link to="/map" className="hover:text-primary transition" activeProps={{ className: "text-primary" }}>Agents</Link>
          {authed && <Link to="/saved" className="hover:text-primary transition" activeProps={{ className: "text-primary" }}>Saved</Link>}
          {authed && <Link to="/imports" className="hover:text-primary transition" activeProps={{ className: "text-primary" }}>Imports</Link>}
          <Link to="/pricing" className="hover:text-primary transition" activeProps={{ className: "text-primary" }}>Pricing</Link>
          <Link to="/about" className="hover:text-primary transition" activeProps={{ className: "text-primary" }}>About</Link>
        </nav>
        <div className="flex items-center gap-2">
          <InstallButton />
          {authed ? (
            <>
              <Link to="/dashboard"><Button variant="ghost" size="sm">Dashboard</Button></Link>
              <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>Sign out</Button>
            </>
          ) : (
            <Link to="/auth"><Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 glow-cyan">Sign in</Button></Link>
          )}
        </div>
      </div>
    </header>
  );
}
