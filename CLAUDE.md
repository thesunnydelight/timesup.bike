# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static site for Times Up Bike Co-Op, built with Astro 5. The site promotes pedal-powered mutual aid and provides information about the bike co-op's schedule, location, events, and parts catalog.

## Development Commands

```bash
# Development server (http://localhost:4321)
npm run dev

# Development server but allow access for other devices on network
npm run dev -- --host

# Production build (outputs to dist/)
npm run build

# Preview production build locally
npm run preview
```

## Architecture

### Tech Stack
- **Framework**: Astro 5 with MDX support
- **Styling**: Tailwind CSS 4 (via @tailwindcss/vite)
- **CMS**: Decap CMS (formerly Netlify CMS) for content management
- **Deployment**: Git-based deployment via git-gateway backend

### Content Management

Content is managed through Decap CMS and stored as JSON files in `src/content/`:
- `home.json` - Hero, schedule, overview, location, join, and contact sections
- `events.json` - Events listing
- `parts.json` - Parts catalog
- `about.json` - About page content

The CMS is configured in `public/admin/config.yml` and accessible at `/admin` when running locally with `local_backend: true`.

### Project Structure

```
src/
├── components/     # Astro components (Home.astro, Events.astro, Parts.astro, About.astro)
├── content/        # JSON content files managed by Decap CMS
├── layouts/        # Layout.astro - shared header/footer/navigation
├── pages/          # Route pages (index, about, events, parts)
└── styles/         # global.css

public/
├── admin/          # Decap CMS configuration and admin UI
└── uploads/        # Media files uploaded via CMS
```

### Key Patterns

**Content-Component Pattern**: Each page has a corresponding component (e.g., `Home.astro`) that imports and renders its JSON content file. Pages in `src/pages/` are minimal wrappers around these components.

**Text Linkification**: The `Home.astro` component includes a `linkifyText()` function that automatically converts email addresses and specific keywords (like "Membership Page") into clickable links when rendering content.

**Layout**: All pages use `Layout.astro` which provides:
- Sticky header with logo and navigation
- Main content slot
- Footer with social links and organization description

**Styling**: Component styles are scoped within `<style>` blocks in `.astro` files. Global styles and CSS custom properties (like `--site-gradient`) are defined in `Layout.astro`.

## Content Editing

To edit content, run the dev server and navigate to `http://localhost:4321/admin`. Changes made through the CMS are saved to JSON files in `src/content/`.

Email addresses in content are automatically linked when rendered on the site.
