import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	// The lessons of the tour (src/pages/tour/), one Markdown file each. The directory is the
	// chapter (src/tour.ts) and `order` the place in it.
	tour: defineCollection({
		loader: glob({ pattern: '**/*.md', base: './src/content/tour' }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			order: z.number(),
		}),
	}),
};
