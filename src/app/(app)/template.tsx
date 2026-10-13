/**
 * A template (unlike a layout) re-mounts on every navigation, so this gives
 * each page a short entrance. CSS only, so it is safe for server rendering
 * and honours prefers-reduced-motion (see `.page-in` in globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
