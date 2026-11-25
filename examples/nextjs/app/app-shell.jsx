'use client';

import { usePathname } from 'next/navigation';

export default function AppShell({ name, links, signedIn, showStudio, editSidebar, allowRegistration, children }) {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/signup') return children;
  return <div className="site-shell">
    <aside className="site-sidebar">
      <a className="site-name" href="/"><span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>{name}</a>
      <nav aria-label="Main navigation">
        {links.map(({ href, label, section }, index) => <div key={index}>
          {section && section !== links[index - 1]?.section && <small>{section}</small>}
          <a href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</a>
        </div>)}
      </nav>
      {showStudio && <nav className="site-account" aria-label="Administration"><a href="/studio" aria-current={pathname === '/studio' ? 'page' : undefined}>Page Studio</a></nav>}
      {editSidebar && <a href="/studio?sidebar">Edit sidebar</a>}
      {!signedIn && <nav className="site-account" aria-label="Account">
        <a href="/login">Sign in</a>
        {allowRegistration && <a href="/signup">Create an account</a>}
      </nav>}
    </aside>
    <div className="site-content">{children}</div>
  </div>;
}
