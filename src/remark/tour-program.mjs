// The program of a lesson of the tour: the ```emela check tour block of the Markdown is taken out
// of the text and put into the frontmatter as `program` (read by src/pages/tour/), for the editor
// beside the text. The ```console block right after it, the expected output that
// scripts/check-examples.mjs checks, is dropped: the reader runs the program instead.
export function remarkTourProgram() {
  return (tree, file) => {
    const children = tree.children;
    const at = children.findIndex(
      (node) => node.type === 'code' && node.lang === 'emela' && /\btour\b/.test(node.meta ?? ''),
    );
    if (at < 0) return;
    const program = children[at].value + '\n';
    const next = children[at + 1];
    const drop = next?.type === 'code' && next.lang === 'console' ? 2 : 1;
    children.splice(at, drop);
    file.data.astro ??= {};
    file.data.astro.frontmatter ??= {};
    file.data.astro.frontmatter.program = program;
  };
}
