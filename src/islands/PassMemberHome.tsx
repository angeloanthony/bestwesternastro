/** @jsxImportSource preact */
// PassMemberHome — the M4 member experience, rendered inside the authenticated
// dashboard (PassDashboard). NOT a separate hydration root: it's a child module
// of the single `client:only` island bundle on /pass, so no extra JS ships to
// the public SEO pages.
//
// Owns the shared state the three sections read/write — favorites, the
// recently-viewed trail, and the trip — so a heart tapped in the browser updates
// My Adventures and feeds the planner instantly. All persistence is RLS-scoped
// to the signed-in member (src/lib/favorites, src/lib/trip); it degrades to a
// friendly state if a call fails and never affects public pages.
import { useEffect, useState } from 'preact/hooks';
import { getFavoriteSlugs, addFavorite, removeFavorite } from '../lib/favorites';
import { getTrip, type Trip } from '../lib/trip';
import { getRecentlyViewed, recordView } from '../lib/recently-viewed';
import { track } from '../lib/analytics';
import PassMyAdventures from './PassMyAdventures';
import PassAdventureBrowser from './PassAdventureBrowser';
import PassTripPlanner from './PassTripPlanner';

const EMPTY_TRIP: Trip = {
  arrival: null,
  departure: null,
  interests: [],
  days: null,
  hasItinerary: false,
};

export default function PassMemberHome({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [recently, setRecently] = useState<string[]>([]);
  const [trip, setTrip] = useState<Trip>(EMPTY_TRIP);

  useEffect(() => {
    let active = true;
    setRecently(getRecentlyViewed());
    (async () => {
      const [favs, t] = await Promise.all([getFavoriteSlugs(userId), getTrip(userId)]);
      if (!active) return;
      setFavorites(favs);
      setTrip(t);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const withSaving = (slug: string, on: boolean) =>
    setSaving((prev) => {
      const next = new Set(prev);
      if (on) next.add(slug);
      else next.delete(slug);
      return next;
    });

  async function toggleFavorite(slug: string) {
    if (saving.has(slug)) return;
    const isSaved = favorites.includes(slug);
    // Optimistic update; revert on failure.
    setFavorites((prev) => (isSaved ? prev.filter((s) => s !== slug) : [slug, ...prev]));
    withSaving(slug, true);

    const result = isSaved ? await removeFavorite(userId, slug) : await addFavorite(userId, slug);
    if (!result.ok) {
      setFavorites((prev) => (isSaved ? [slug, ...prev] : prev.filter((s) => s !== slug)));
    } else {
      track(isSaved ? 'favorite_removed' : 'favorite_added', { slug });
    }
    withSaving(slug, false);
  }

  function onView(slug: string) {
    setRecently(recordView(slug));
  }

  if (loading) {
    return (
      <p class="text-[#1a2e52]" role="status" aria-live="polite">
        Loading your adventures…
      </p>
    );
  }

  return (
    <div class="grid gap-8">
      <PassMyAdventures
        favorites={favorites}
        recently={recently}
        interests={trip.interests}
        saving={saving}
        onToggle={toggleFavorite}
        onView={onView}
      />

      <hr class="border-[#1a2e52]/10" />

      <PassTripPlanner
        userId={userId}
        favorites={favorites}
        trip={trip}
        onChange={(next) => setTrip((prev) => ({ ...prev, ...next }))}
      />

      <hr class="border-[#1a2e52]/10" />

      <PassAdventureBrowser
        favorites={favorites}
        saving={saving}
        onToggle={toggleFavorite}
        onView={onView}
      />
    </div>
  );
}
