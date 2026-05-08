import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

// Map agent.id (state code) -> { state full name, major_city } for RentCast queries
const AGENT_TARGETS: Array<{ id: string; state: string; city: string }> = [
  { id: 'AZ', state: 'Arizona', city: 'Phoenix' },
  { id: 'CA', state: 'California', city: 'Los Angeles' },
  { id: 'CO', state: 'Colorado', city: 'Denver' },
  { id: 'FL', state: 'Florida', city: 'Miami' },
  { id: 'GA', state: 'Georgia', city: 'Atlanta' },
  { id: 'IL', state: 'Illinois', city: 'Chicago' },
  { id: 'MA', state: 'Massachusetts', city: 'Boston' },
  { id: 'NV', state: 'Nevada', city: 'Las Vegas' },
  { id: 'NY', state: 'New York', city: 'New York' },
  { id: 'OR', state: 'Oregon', city: 'Portland' },
  { id: 'TX', state: 'Texas', city: 'Austin' },
  { id: 'WA', state: 'Washington', city: 'Seattle' },
]

const RENTCAST_BASE = 'https://api.rentcast.io/v1/listings/rental/long-term'
const PER_STATE_LIMIT = 25
const STALE_HOURS = 36

type RentCastListing = {
  id: string
  formattedAddress?: string
  addressLine1?: string
  city?: string
  state?: string
  zipCode?: string
  latitude?: number
  longitude?: number
  bedrooms?: number
  bathrooms?: number
  squareFootage?: number
  price?: number
  propertyType?: string
  status?: string
}

async function fetchStateListings(target: typeof AGENT_TARGETS[number], apiKey: string) {
  const url = new URL(RENTCAST_BASE)
  url.searchParams.set('city', target.city)
  url.searchParams.set('state', target.id)
  url.searchParams.set('status', 'Active')
  url.searchParams.set('limit', String(PER_STATE_LIMIT))

  const res = await fetch(url.toString(), {
    headers: { 'X-Api-Key': apiKey, accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`RentCast ${target.id} ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as RentCastListing[] | { listings?: RentCastListing[] }
  return Array.isArray(data) ? data : data.listings ?? []
}

export const Route = createFileRoute('/api/public/hooks/rentcast-sync')({
  server: {
    handlers: {
      POST: async () => {
        const apiKey = process.env.RENTCAST_API_KEY
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'RENTCAST_API_KEY missing' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          })
        }

        const startedAt = new Date()
        const results: Record<string, { fetched: number; upserted: number; error?: string }> = {}
        let totalUpserted = 0

        for (const target of AGENT_TARGETS) {
          try {
            const listings = await fetchStateListings(target, apiKey)
            const rows = listings
              .filter((l) => l && l.id)
              .map((l) => ({
                rentcast_id: String(l.id),
                agent_id: target.id,
                address: l.formattedAddress ?? l.addressLine1 ?? null,
                city: l.city ?? target.city,
                state: l.state ?? target.id,
                zip: l.zipCode ?? null,
                lat: l.latitude ?? null,
                lng: l.longitude ?? null,
                bedrooms: l.bedrooms ?? null,
                bathrooms: l.bathrooms ?? null,
                sqft: l.squareFootage ?? null,
                price: l.price ?? null,
                property_type: l.propertyType ?? null,
                status: (l.status ?? 'active').toLowerCase(),
                raw: l as unknown as Record<string, unknown>,
                last_seen_at: startedAt.toISOString(),
              }))

            if (rows.length > 0) {
              const { error } = await supabaseAdmin
                .from('rentcast_listings')
                .upsert(rows as never, { onConflict: 'rentcast_id' })
              if (error) throw error
            }

            totalUpserted += rows.length
            results[target.id] = { fetched: listings.length, upserted: rows.length }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.error(`rentcast-sync ${target.id} failed:`, msg)
            results[target.id] = { fetched: 0, upserted: 0, error: msg }
          }
        }

        // Mark stale listings as inactive
        const staleCutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString()
        const { error: staleErr, count: staleCount } = await supabaseAdmin
          .from('rentcast_listings')
          .update({ status: 'inactive' }, { count: 'exact' })
          .lt('last_seen_at', staleCutoff)
          .neq('status', 'inactive')
        if (staleErr) console.error('rentcast-sync stale update failed:', staleErr.message)

        return new Response(
          JSON.stringify({
            ok: true,
            startedAt: startedAt.toISOString(),
            totalUpserted,
            markedInactive: staleCount ?? 0,
            results,
          }),
          { headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  },
})
