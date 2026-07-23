// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightCatppuccin from "@catppuccin/starlight";
import { rehypeBaseLinks } from './src/rehype/base-links.mjs';

// GitHub Pages のプロジェクトサイトとして https://emela-lang.github.io/docs/ に
// 配信する。`base` を付けると内部リンクや静的アセットはこのサブパス配下になる。
const SITE = 'https://emela-lang.github.io';
const BASE = '/docs';

// Emela 用のシンタックスハイライト定義（TextMate grammar）を読み込む。
// Starlight に内蔵された Expressive Code / Shiki にカスタム言語として登録する。
const emelaGrammar = JSON.parse(
  readFileSync(new URL('./src/grammars/emela.tmLanguage.json', import.meta.url), 'utf-8'),
);

// Expressive Code plugin: mark a code block as runnable only when its meta
// string opts in with `run`, e.g. ```emela run. It sets `data-emela-run="true"`
// on the block root; the client script (RunButtons.astro) attaches a "▶ Run"
// button to exactly those blocks — so a plain ```emela block gets no button.
const emelaRunnablePlugin = {
  name: 'emela-runnable',
  hooks: {
    postprocessRenderedBlock: (context) => {
      if (context.codeBlock.language !== 'emela') return;
      if (context.codeBlock.metaOptions.getBoolean('run') !== true) return;
      const root = context.renderData.blockAst;
      root.properties = root.properties || {};
      root.properties['data-emela-run'] = 'true';
    },
  },
};

// https://astro.build/config
export default defineConfig({
	site: SITE,
	base: BASE,
	// 本文 Markdown / MDX の root 絶対リンク（例 /reference/values/）に build 時
	// base を付与する。Astro は base を自動付与しないため、この pass で吸収する。
	markdown: {
		rehypePlugins: [[rehypeBaseLinks, { base: BASE }]],
	},
	integrations: [
		starlight({
			title: 'Emela',
      expressiveCode: {
        shiki: {
          // ```emela コードブロックをハイライトできるようにする。
          langs: [emelaGrammar],
        },
        // `run` meta（```emela run）が付いたブロックだけ Run ボタン対象にする。
        plugins: [emelaRunnablePlugin],
      },
      plugins: [starlightCatppuccin()],
      customCss: [
        '@fontsource/ibm-plex-sans-jp/400.css',
        '@fontsource/ibm-plex-sans-jp/700.css',
        // Monospace face for the Playground editor / Run output.
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/600.css',
        './src/styles/custom.css',
      ],
      // Override Starlight's Footer to also load the global Run-button script
      // (src/components/RunButtons.astro), so `fn main` code blocks on every
      // page get a "▶ Run" button backed by the browser wasm playground.
      components: {
        Footer: './src/components/Footer.astro',
      },
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/emela-lang' }],
			sidebar: [
				{ label: 'Playground', slug: 'playground' },
				{
					label: 'はじめに',
					items: [
						{ label: 'Emela とは', slug: 'guides/introduction' },
						{ label: 'インストールとプロジェクト', slug: 'guides/installation' },
						{ label: 'Hello, World', slug: 'guides/hello-world' },
						{ label: '言語ツアー', slug: 'guides/tour' },
					],
				},
				{
					label: '他言語からの移行',
					items: [
						{ label: '移行の全体像', slug: 'migration/overview' },
						{ label: 'Python から', slug: 'migration/python' },
						{ label: 'TypeScript から', slug: 'migration/typescript' },
						{ label: 'C / C++ から', slug: 'migration/c-cpp' },
						{ label: 'Go から', slug: 'migration/go' },
						{ label: 'Java から', slug: 'migration/java' },
						{ label: 'Ruby から', slug: 'migration/ruby' },
						{ label: 'Gleam から', slug: 'migration/gleam' },
						{ label: 'Rust から', slug: 'migration/rust' },
					],
				},
				{
					label: 'リファレンス',
					items: [
						{ label: '値と型', slug: 'reference/values' },
						{ label: '束縛と関数', slug: 'reference/functions' },
						{ label: '式と制御フロー', slug: 'reference/expressions' },
						{ label: 'データ型', slug: 'reference/data-types' },
						{ label: 'ジェネリクス', slug: 'reference/generics' },
						{ label: 'エフェクト（uses）', slug: 'reference/effects' },
						{ label: 'エラー（throws）', slug: 'reference/errors' },
						{ label: 'トレイト', slug: 'reference/traits' },
						{ label: 'モジュールとインポート', slug: 'reference/modules' },
						{ label: 'ランタイム境界', slug: 'reference/runtime-boundary' },
					],
				},
			],
		}),
	],
});
