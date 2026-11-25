'use client';

import { usePathname } from 'next/navigation';

export default function AppShell({ name, links, signedIn, showStudio, allowRegistration, children }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/signup') return children;
  return <div className="site-shell">
    <aside className="site-sidebar">
      <a className="site-name" href="/"><span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>{name}</a>
      <nav aria-label="Main navigation">
        {links.map(({ href, label }) => <a key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</a>)}
      </nav>
      {showStudio && <nav className="site-account" aria-label="Administration"><a href="/studio" aria-current={pathname === '/studio' ? 'page' : undefined}>Page Studio</a></nav>}
      {!signedIn && <nav className="site-account" aria-label="Account">
        <a href="/login">Sign in</a>
        {allowRegistration && <a href="/signup">Create an account</a>}
      </nav>}
    </aside>
    <div className="site-content">{children}</div>
  </div>;
}
