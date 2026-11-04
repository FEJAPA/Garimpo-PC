// Bloco "esqueleto" (placeholder) enquanto algo carrega. Some para leitores de
// tela (aria-hidden); quem usa anuncia o carregamento de outro jeito.
// A pulsação respeita prefers-reduced-motion (motion-safe).

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded-control bg-surface-3 motion-safe:animate-pulse ${className}`} />;
}
