/**
 * Inline script to set theme before paint (avoids flash).
 * Must be first in body so it runs before React hydrates.
 */
export function ThemeInitScript() {
  const fn = `(function(){var t=localStorage.getItem('regaged_theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;})()`;
  return <script dangerouslySetInnerHTML={{ __html: fn }} />;
}
