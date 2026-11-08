# Keep Sunrise Open

Community website for Sunrise Elementary families. It explains the district's closure scenarios, shows what the district's own data say, proposes alternatives, and collects community stories.

Plain HTML, CSS and JavaScript. No build step and no dependencies.

## Preview locally

Any one of these works:

```bash
npm run dev                # serves at http://localhost:8080 (needs Node)
python3 -m http.server 8080 # no Node needed
```

You can also just double-click `index.html`. Everything works except the story form, which only submits once the site is on Netlify.

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify, choose **Add new site → Import an existing project** and pick `justise/save-sunrise`.
3. Leave the build command empty and set the publish directory to `.`. `netlify.toml` already sets this.
4. After the first deploy, open **Forms** in the Netlify dashboard. You'll see `sunrise-story`. Turn on email notifications so new stories reach you.

## Updating content

| What | Where |
|---|---|
| Any number, scenario, timeline date or source | `data/sunrise-data.js`. Charts and tables update automatically. |
| Board vote date, contact email, "last updated" | `SITE_CONFIG` at the top of `data/sunrise-data.js` |
| Community stories | `data/stories.js`. Copy approved submissions from Netlify Forms, and only post stories with permission. |
| Page text | `index.html` (home) and `data.html` (data and sources) |
| Colors and fonts | `assets/styles.css` (variables at the top) |

## Before you share widely

- **Check the timeline dates.** They come from the district process described on keepcottagelake.org. Confirm them with the district and add the Sunrise hearing date when it's announced.
- **Replace the placeholder funding figure.** The calculator's default of $12,000 state funding per student is an assumption. Swap in a sourced per-pupil figure.
- **Check S6 and S9.** Both are PDFs shared in the parent group. Consider hosting them in `/docs` and linking to them.
- Every figure labeled "calc" is our own calculation, not a district figure.

## File layout

```
index.html          Home: situation, facts, alternatives, calculator, stories
data.html           Full data tables and sources
thanks.html         Shown after someone submits a story
data/sunrise-data.js  All numbers (single source of truth)
data/stories.js     Approved community stories
assets/styles.css   Styles
assets/charts.js    Small SVG chart helpers (no libraries)
assets/app.js       Page behavior
netlify.toml        Netlify settings
```
