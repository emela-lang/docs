// The chapters of the tour, in order. A lesson's chapter is the directory of its file under
// src/content/tour/ ('' for the files at the top).
import { getCollection, type CollectionEntry } from 'astro:content';

export const chapters = [
  { dir: '', title: 'はじめに' },
  { dir: 'basics', title: '1. 基本' },
  { dir: 'data', title: '2. データ' },
  { dir: 'errors', title: '3. エラー' },
  { dir: 'effects', title: '4. エフェクト' },
  { dir: 'concurrency', title: '5. 並行処理' },
  { dir: 'more', title: '6. その先へ' },
] as const;

export type Lesson = CollectionEntry<'tour'> & { chapter: string; href: string };

function dirOf(id: string): string {
  const slash = id.lastIndexOf('/');
  return slash < 0 ? '' : id.slice(0, slash);
}

/** All lessons in reading order. */
export async function lessons(): Promise<Lesson[]> {
  const entries = await getCollection('tour');
  const rank = (entry: CollectionEntry<'tour'>) => chapters.findIndex((c) => c.dir === dirOf(entry.id));
  return entries
    .filter((entry) => rank(entry) >= 0)
    .sort((a, b) => rank(a) - rank(b) || a.data.order - b.data.order)
    .map((entry) => ({
      ...entry,
      chapter: chapters[rank(entry)].title,
      href: entry.id === 'index' ? '/tour/' : `/tour/${entry.id}/`,
    }));
}
