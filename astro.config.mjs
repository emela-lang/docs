// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightCatppuccin from "@catppuccin/starlight";
import { rehypeBaseLinks } from './src/rehype/base-links.mjs';

// GitHub Pages のカスタムドメイン https://docs.emela.dev/ のルートに配信する。
// サブパスに戻すときは BASE を変える（内部リンクと静的アセットがその配下になる）。
const SITE = 'https://docs.emela.dev';
const BASE = '/';

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
				{
					label: 'はじめに',
					items: [
						{ label: 'Emela とは', slug: 'start/introduction' },
						{ label: 'インストール', slug: 'start/installation' },
						{ label: '最初のプロジェクト', slug: 'start/first-project' },
						{ label: '言語ツアー', slug: 'start/tour' },
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
						{ label: 'Console・Clock・Random・Env', slug: 'std/platform' },
						{ label: 'FileSystem と Path', slug: 'std/file-system' },
						{ label: 'Http', slug: 'std/http' },
						{ label: 'State・Fiber・Deferred', slug: 'std/state-fiber' },
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
