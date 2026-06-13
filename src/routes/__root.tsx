import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { SiteHeader } from "@/components/SiteHeader";
import { CompareBar } from "@/components/CompareBar";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">This agent's off the grid</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 glow-cyan">Back home</Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RentAgent.io — 50 AI Agents. 50 States. One rental search." },
      { name: "description", content: "Meet a unique AI rental agent for every US state. Chat, explore listings, and find your next home — without the Zillow chaos." },
      { name: "theme-color", content: "#4f46e5" },
      { property: "og:title", content: "RentAgent.io — 50 AI Agents. 50 States. One rental search." },
      { name: "twitter:title", content: "RentAgent.io — 50 AI Agents. 50 States. One rental search." },
      { property: "og:description", content: "Meet a unique AI rental agent for every US state. Chat, explore listings, and find your next home — without the Zillow chaos." },
      { name: "twitter:description", content: "Meet a unique AI rental agent for every US state. Chat, explore listings, and find your next home — without the Zillow chaos." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/829baaba-e2b3-4bd7-89d5-a084af664a1c/id-preview-40234979--0632b21f-b411-4099-aa84-6a2ca5449ebe.lovable.app-1778073864575.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/829baaba-e2b3-4bd7-89d5-a084af664a1c/id-preview-40234979--0632b21f-b411-4099-aa84-6a2ca5449ebe.lovable.app-1778073864575.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800;900&family=Epilogue:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <SiteHeader />
      <Outlet />
      <CompareBar />
      <Toaster theme="dark" />
    </>
  );
}
