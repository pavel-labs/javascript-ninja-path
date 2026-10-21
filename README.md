# JavaScript Ninja Path

**A personal path through the JavaScript ecosystem — questions, answers, and examples.**

This is my personal study material, assembled by hand and organised according to my own priorities and understanding. It reflects what I find important, how I explain it, and what I want to revisit as I keep learning.

The collection contains **153 study topics, 210 follow-up questions, and 118 code examples across 24 chapters**. It covers JavaScript, TypeScript, React, React Native, Next.js, state management, architecture, testing, performance, CSS, HTML, and security.

The expanded collection also covers HTTP caching and CORS, query-cache design, idempotent requests, accessible UI patterns, build pipelines, dependency delivery, production debugging, time zones, and currency localization. New topics include links to official documentation.

The original material is in English. Its questions, detailed answers, plain-language explanations, follow-ups, examples, comparison tables, and React Native architecture figure are preserved. The original single-file interface, version badges, and introductory interview instructions are excluded.

## Website

[Read JavaScript Ninja Path](https://pavel-labs.github.io/javascript-ninja-path/)

The site is built as static HTML. Every topic has a direct URL and is readable without JavaScript. Search, colour themes, code copying, and reading progress enhance the static pages. Progress and theme preferences stay in the visitor’s browser; no account is needed.

GitHub Actions checks the content and links, builds the site, and publishes `main` to GitHub Pages. Pull requests run the checks without deploying.

## Run locally

Requires Node.js 22 or later. There are no package dependencies to install.

```sh
npm run dev
```

Open `http://localhost:4173`. Re-run the command after editing source files.

```sh
npm test
npm run build
```

The output is written to `dist/`. To build under a project path:

```sh
BASE_PATH=/javascript-ninja-path SITE_URL=https://pavel-labs.github.io npm run build
```

## Edit the material

The source material lives in `content/`, with one JSON file per chapter. `content/catalog.json` defines the chapter order. Each topic has a stable ID, title, priority, and HTML answer, so examples and tables remain easy to maintain without a framework.

- Edit the relevant topic’s `title` or `html` to update an answer.
- Add a topic with a unique ID to extend a chapter.
- Add a chapter file and include its slug in `catalog.json` to extend the collection.
- Run `npm test` and `npm run build` before publishing changes.

`scripts/import-html.py` records how the material was extracted from the original `senior-frontend-interview-v9.html`. It uses Python’s standard library, imports only the study cards, and extracts the embedded architecture figure. The original upload is not part of the repository. Re-running the importer replaces the chapter files, so review local edits first.

```sh
python3 scripts/import-html.py /path/to/senior-frontend-interview-v9.html
```

## GitHub Pages

In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source. The workflow in `.github/workflows/pages.yml` handles subsequent pushes to `main`. It uses GitHub’s built-in token with Pages and OIDC permissions; no personal access token or other deployment secret is required.

The workflow derives the project prefix and site origin from the repository name and owner. If a custom domain is added later, update the build’s `BASE_PATH` and `SITE_URL` values accordingly.
