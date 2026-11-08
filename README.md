# Keep Sunrise Open: Alternatives

Styled to match sunrisesoars.org (tokens at the top of `assets/styles.css`). Sunrise Elementary parents use this site to test alternatives to closure with the district's own data and to present the strongest ones to EDAC and the Northshore school board. The petition, community stories and legal fund are on [Sunrise Soars](https://sunrisesoars.org/).

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home: the five options at a glance, key dates, and the district scenarios |
| `options.html` | Evidence, trade-offs and sources for each option |
| `enrollment.html` | Class-by-class chart (is the dip temporary?), a fill-Sunrise tool, and seat use across the district |
| `compare.html` | Full-cost comparison of the scenarios, plus a weighted scorecard. "Copy link" saves the current settings in the URL. |
| `data.html` | Every table and source |

## Preview locally

```bash
npm run dev                 # http://localhost:8080 (needs Node)
python3 -m http.server 8080 # no Node needed
```

You can also open `index.html` directly in a browser.

## Deploy to Netlify

Import `justise/save-sunrise` in Netlify. `netlify.toml` already sets the publish directory to `.`, with no build command.

## Updating content

| What | Where |
|---|---|
| Any number, scenario, pocket, staffing tier, timeline date or source | `data/sunrise-data.js`. Charts, tools and tables update automatically. |
| Board vote date, partner link, contact email, "last updated" | `SITE_CONFIG` at the top of `data/sunrise-data.js` |
| Option cards (short) and option evidence (full) | `index.html` and `options.html` |
| Default weights and inputs for the scorecard | `DEFAULTS` at the top of `assets/compare.js` |

## Before you share it widely

- **Timeline dates:** confirm them with the district, and add the Sunrise hearing date when it's announced.
- **Funding placeholder:** replace the $12,000-per-student state funding figure with a sourced one.
- **Linked files:** host the S6, S9, S11 and S12 files in a `/docs` folder and link them.
- **Our calculations:** anything labeled "calc" is our own calculation, not a district figure.

## File layout

```
index.html, enrollment.html, compare.html, data.html
data/sunrise-data.js   All numbers (single source of truth)
assets/app.js          Shared behavior and helpers
assets/charts.js       Small SVG chart helpers (no libraries)
assets/enrollment.js   Enrollment tool
assets/compare.js      Full-cost comparison and scorecard
assets/styles.css      Styles
netlify.toml           Netlify settings
```
