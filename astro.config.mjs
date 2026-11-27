// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { rehypeBaseLinks } from './src/rehype/base-links.mjs';
import { remarkTourProgram } from './src/remark/tour-program.mjs';

// GitHub Pages のカスタムドメイン https://docs.emela.dev/ のルートに配信する。
// サブパスに戻すときは BASE を変える（内部リンクと静的アセットがその配下になる）。
const SITE = 'https://docs.emela.dev';
const BASE = '/';

// Emela 用のシンタックスハイライト定義（TextMate grammar）を読み込む。
// Starlight に内蔵された Expressive Code / Shiki にカスタム言語として登録する。
const emelaGrammar = JSON.parse(
  readFileSync(new URL('./src/grammars/emela.tmLanguage.json', import.meta.url), 'utf-8'),
);

// コードブロックの配色。ダークは beryl.vim の Beryl、ライトはその色相を濃くした Beryl Light。
// Playground のエディタ（src/scripts/emela-highlight.ts）も同じ2つを使う。
const readTheme = (name) =>
  JSON.parse(readFileSync(new URL(`./src/themes/${name}.json`, import.meta.url), 'utf-8'));
const berylThemes = [readTheme('beryl'), readTheme('beryl-light')];

// Expressive Code plugin: marks a code block as runnable with
// `data-emela-run="true"` on the block root; the client script (RunButtons.astro)
// attaches a "▶ Run" button to exactly those blocks. A block is runnable when its
// meta says `run` (```emela run), or when it says `check` (a complete program
// that CI checks, see scripts/check-examples.mjs) and defines `main`. A plain
// ```emela block or a ```emela check=error block gets no button.
const emelaRunnablePlugin = {
  name: 'emela-runnable',
  hooks: {
    postprocessRenderedBlock: (context) => {
      const block = context.codeBlock;
      if (block.language !== 'emela') return;
      const meta = block.meta.split(/\s+/);
      const root = context.renderData.blockAst;
      root.properties = root.properties || {};
      const runnable =
        meta.includes('run') || (meta.includes('check') && /^fn main\(/m.test(block.code));
      if (!runnable) return;
      root.properties['data-emela-run'] = 'true';
    },
  },
};

// https://astro.build/config
export default defineConfig({
	site: SITE,
	base: BASE,
	// 0.29 で Std.Fiber が Std.Task になったときに名前を変えたページ。古い URL から転送する。
	redirects: {
		'/std/state-fiber/': '/std/state-task/',
		'/tour/concurrency/fibers/': '/tour/concurrency/tasks/',
		'/tour/concurrency/scope/': '/tour/concurrency/group/',
	},
	// 本文 Markdown / MDX の root 絶対リンク（例 /reference/values/）に build 時
	// base を付与する。Astro は base を自動付与しないため、この pass で吸収する。
	markdown: {
		remarkPlugins: [remarkTourProgram],
		rehypePlugins: [[rehypeBaseLinks, { base: BASE }]],
	},
	integrations: [
		starlight({
			title: 'Emela',
      expressiveCode: {
        themes: berylThemes,
        // 枠や背景は Starlight の色（src/styles/starlight-beryl.css）に合わせる。
        useStarlightUiThemeColors: true,
        // テーマの色をそのまま使う（どちらも本文の背景で 4.5:1 以上ある）。Playground と揃えるため。
        minSyntaxHighlightingColorContrast: 0,
        shiki: {
          // ```emela コードブロックをハイライトできるようにする。
          langs: [emelaGrammar],
        },
        // `run` meta（```emela run）が付いたブロックだけ Run ボタン対象にする。
        plugins: [emelaRunnablePlugin],
      },
      customCss: [
        '@fontsource/ibm-plex-sans-jp/400.css',
        '@fontsource/ibm-plex-sans-jp/700.css',
        // Monospace face for the Playground editor / Run output.
        '@fontsource/ibm-plex-mono/400.css',
        '@fontsource/ibm-plex-mono/600.css',
        // Beryl sets keywords and comments in italic; without the face the browser slants the upright one.
        '@fontsource/ibm-plex-mono/400-italic.css',
        './src/styles/starlight-beryl.css',
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
				{
					label: 'はじめに',
					items: [
						{ label: 'Emela とは', slug: 'start/introduction' },
						{ label: 'インストール', slug: 'start/installation' },
						{ label: '最初のプロジェクト', slug: 'start/first-project' },
						{ label: 'Emela ツアー', link: '/tour/' },
						{ label: '他の言語との対応', slug: 'start/coming-from' },
						{ label: '実装の状況', slug: 'start/status' },
					],
				},
				{
					label: '言語ガイド',
					items: [
						{ label: '基本の構文', slug: 'guide/basics' },
						{ label: '基本の型', slug: 'guide/types' },
						{ label: '束縛と関数', slug: 'guide/functions' },
						{ label: '制御の流れ', slug: 'guide/control-flow' },
						{ label: 'パターンマッチ', slug: 'guide/pattern-matching' },
						{ label: 'データ型', slug: 'guide/data' },
						{ label: '型引数', slug: 'guide/generics' },
						{ label: 'モジュールと公開範囲', slug: 'guide/modules' },
						{ label: 'エラー', slug: 'guide/errors' },
						{ label: 'エフェクトとハンドラ', slug: 'guide/effects' },
						{ label: '状態と資源', slug: 'guide/resources' },
						{ label: 'エフェクトのラベル', slug: 'guide/labels' },
						{ label: '中断する操作', slug: 'guide/suspend' },
						{ label: '並行処理', slug: 'guide/concurrency' },
						{ label: 'テスト', slug: 'guide/testing' },
						{ label: '外部関数', slug: 'guide/external' },
						{ label: 'Trait と導出', slug: 'guide/traits' },
					],
				},
				{
					label: '標準ライブラリ',
					items: [
						{ label: '全体の構成', slug: 'std/overview' },
						{ label: 'Prelude と core', slug: 'std/core' },
						{ label: 'コレクション', slug: 'std/collections' },
						{ label: 'Process と Platform', slug: 'std/platform' },
						{ label: 'FileSystem と Path', slug: 'std/file-system' },
						{ label: 'Http', slug: 'std/http' },
						{ label: 'JSON と Dynamic', slug: 'std/json' },
						{ label: 'State と Task', slug: 'std/state-task' },
						// src/content/docs/std/api/ is generated by scripts/gen-std-api.mjs.
						{
							label: 'API リファレンス',
							collapsed: true,
							items: [{ autogenerate: { directory: 'std/api' } }],
						},
					],
				},
				{
					label: 'ツール',
					items: [
						{ label: 'emela コマンド', slug: 'tools/cli' },
						{ label: 'プロジェクトと Pome', slug: 'tools/pome' },
						{ label: 'エディタと言語サーバー', slug: 'tools/editors' },
					],
				},
				{
					label: 'リファレンス',
					items: [
						{ label: '字句と予約語', slug: 'reference/lexical' },
						{ label: '文法', slug: 'reference/grammar' },
						{ label: 'モジュールと名前の解決', slug: 'reference/modules' },
						{ label: '型と効果の体系', slug: 'reference/type-system' },
						{ label: '実行時の意味', slug: 'reference/semantics' },
						{ label: 'ターゲット', slug: 'reference/targets' },
						{ label: '診断コード', slug: 'reference/diagnostics' },
					],
				},
			],
		}),
	],
});
