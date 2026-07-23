// Prepend the configured `base` path to root-relative links and asset URLs in
// rendered Markdown / MDX, so the docs keep working when served from a subpath
// (the GitHub Pages project site at /docs/). Content is authored with plain
// root-absolute links like `/reference/values/`; Astro does not rewrite those
// for `base`, so this build-time hast pass does.
//
// Only internal root-relative paths (`/foo`) are touched. Protocol-relative
// (`//host`), external URLs, in-page anchors (`#id`), and paths already under
// the base are left as-is, so re-running is idempotent.
export function rehypeBaseLinks({ base }) {
  const prefix = base.replace(/\/$/, ''); // '/docs' (no trailing slash)
  if (!prefix) return () => {};

  const attrs = ['href', 'src'];

  const rewrite = (value) => {
    if (typeof value !== 'string') return value;
    if (!value.startsWith('/') || value.startsWith('//')) return value;
    if (value === prefix || value.startsWith(prefix + '/')) return value;
    return prefix + value;
  };

  const walk = (node) => {
    if (node.type === 'element' && node.properties) {
      for (const attr of attrs) {
        if (attr in node.properties) {
          node.properties[attr] = rewrite(node.properties[attr]);
        }
      }
    }
    if (node.children) node.children.forEach(walk);
  };

  return (tree) => walk(tree);
}
