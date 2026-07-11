/** @jsxImportSource preact */
// Smoke-test island — proves the Preact runtime hydrates (Baseline §6, Track A).
// NOT referenced by any production page, so it never ships to the live site.
// Delete this once the first real AdventureOS island (e.g. StickyBookingBar) lands.
import { useState } from 'preact/hooks';

export default function HelloIsland() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((c) => c + 1)}>
      Preact island alive — clicked {count}×
    </button>
  );
}
