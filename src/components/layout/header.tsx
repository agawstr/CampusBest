import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

/** Top bar. On desktop the sidebar carries the logo, so the logo only shows below md. */
export function Header() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-8 md:pt-4">
      <Logo className="md:invisible" />
      <ThemeToggle />
    </header>
  );
}
