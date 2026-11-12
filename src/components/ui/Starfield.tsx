import { memo } from 'react';

/** PRNG deterministik → posisi bintang identik di server & client (tanpa hydration mismatch). */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const rand = seeded(7);
const STARS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  left: `${(rand() * 100).toFixed(2)}%`,
  top: `${(rand() * 100).toFixed(2)}%`,
  size: +(rand() * 2 + 0.8).toFixed(2),
  delay: `${(rand() * 4).toFixed(2)}s`,
  duration: `${(rand() * 3 + 2).toFixed(2)}s`,
}));

function Starfield({ opacity = 1 }: { opacity?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-1000" style={{ opacity }}>
      {STARS.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full bg-cream-50"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animation: `twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
    </div>
  );
}

export default memo(Starfield);
