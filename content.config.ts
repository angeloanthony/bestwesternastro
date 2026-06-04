// content.config.ts  — Astro 6 syntax (project root, NOT src/content/config.ts)
//
// NOTE ON THIS MIGRATION: the legacy Best Western site is a set of
// hand-authored, individually-distinct HTML pages. Per the migration
// rules ("do not merge pages", "do not rewrite content"), the existing
// pages are migrated as discrete .astro files under src/pages/ — they
// are NOT forced into a collection, which would risk flattening their
// unique structure.
//
// This config is scaffolded for PHASE 3 (post-migration content
// expansion) so new informational/local articles can be added as
// type-safe Markdown without copy-pasting HTML. It is intentionally
// inert until you add files under src/content/. Defining it now costs
// nothing and documents the intended growth path from the runbook.

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Informational / traffic articles (e.g. travel guides, area write-ups).
const articles = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    canonical: z.string().url(),
    summary: z.string().min(40),                 // AI-pullable TL;DR (runbook Part 9)
    faqs: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .min(3)
      .optional(),
    pubDate: z.coerce.date().optional(),
  }),
});

// "Hotel near <landmark>" / local-area pages, if later moved to data-driven
// generation. Guardrails from runbook Part 5: each entry must carry genuinely
// unique local content, enforced by the schema, to avoid doorway pages.
const local = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/local' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    canonical: z.string().url(),
    landmark: z.string(),
    distance: z.string(),                        // specific distance, not generic
    localDetail: z.string().min(40),             // forces real, distinct content
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).min(3),
  }),
});

export const collections = { articles, local };
