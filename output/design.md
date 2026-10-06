# Campus Customs: Design (Problem 10)

The goal was a premium, student-friendly Yale apparel storefront that is clearly **Campus Customs**: Yale-inspired, but not a copy of Yale's website. This was a visual pass only. Every feature from Problems 1–9 still works the same way.

---

## 1. Visual identity: "The Stitched C"

> **Revised.** The first Problem 10 logo, a coat-hanger whose hook formed a C ("Hanger-C"), was replaced. It read as too literal, like a generic clothing-store icon, rather than a distinctive Yale student brand.

**The mark:** a heavy, varsity-block **C** with crisp angled terminals. Inside its counter, a second, smaller **C is sewn in as a running stitch** (gold on the brand version).

- **Two Cs = Campus Customs.** It works as a monogram without spelling "CC" or putting letters in a badge.
- **The stitch = "Customs".** Custom embroidery, chenille patches and varsity lettering are what a campus apparel shop makes. That's the brand promise in one detail.
- **Recognisable without words.** A bold C holding a stitched C is a simple shape, and it's ownable.

**Lockup:** the mark plus the stacked wordmark (*CAMPUS* in letter-spaced varsity caps over *Customs* in italic Fraunces, with an optional "Yale apparel · New Haven" tagline).

**How it was chosen.** Six genuinely different directions were drawn in SVG and reviewed at large, 44 px and 16 px, in one colour and on navy:

| Concept | Verdict |
|---|---|
| 1 · Ligature wordmark (one tall C shared by *Campus* and *Customs*) | Elegant as a wordmark, but its icon is just a generic "C" that isn't memorable on its own |
| **2 · Stitched C** | **Chosen.** Strongest on memorability, brand meaning, scaling and one-colour use |
| 3 · Letterman CC (layered varsity twill) | Reads as a target or wifi icon, and the twill outline echoes Yale's athletic Y too closely |
| 4 · Pennant "No. 57" (57 Broadway) | Collegiate, but "57" doesn't say Campus Customs, and it's unreadable at favicon size |
| 5 · Abstract bulldog (two Cs face to face) | Reads as a chick or penguin, and would compete with Dan |
| 6 · Twin Arches (two Cs rotated into campus gateway arches) | Clever idea, but the silhouette reads as a letter "m" |

The Stitched C was then refined in three versions (round terminals, angled terminals, angled plus thread tail). **Angled terminals** won: they feel more varsity and premium, and stay the cleanest at 16 px. The thread tail was charming but added noise at small sizes.

**Usage and scaling:**

- **Tones:** `tone="color"` (navy C + gold stitch, light backgrounds), `tone="reverse"` (cream C + gold stitch, the dark footer) and `tone="mono"` (one colour, `currentColor`). It holds up in solid black.
- **Small sizes:** under 28 px the dashed stitch becomes a solid inner stroke so it doesn't blur.
- **Favicon (`public/favicon.svg`):** the small version. Its C switches to cream when the browser uses a dark colour scheme, because navy disappears on a dark tab.
- **Where it appears:** header (50 px lockup), footer (reversed), and the Log in and Create account cards. The old hanger and shield are gone everywhere.
- **Micro-interaction:** hovering the logo in the header or footer makes the stitch "sew" around the inner C (animated dash offset). It's disabled under reduced motion.

**Fit with the rest of the brand:**

- **Dan** stays the playful character. The mark is geometric and quiet, so the two don't compete, and Dan stays the face of the chat.
- **No licensing claim:** the site describes itself as a "Yale campus collection" in plain text, next to an original gold **collection seal** (see section 6). We have no licensing documentation, so the site never says "officially licensed". The Stitched C uses no Y, crest, bulldog or Yale typeface, so it reads as Campus Customs' own mark.

## 2. Typography

| Role | Font | Why |
|---|---|---|
| Display (headlines, product names, prices, wordmark) | **Fraunces** (soft editorial serif, with italics) | Gives an editorial, premium feel. The italic carries the brand ("*every* day", "*Customs*"). |
| UI / body | **Manrope** | A clean, very readable sans for forms, chat and small text. |
| Accents (eyebrows, category labels, sizes, varsity ticker) | **Graduate** (varsity slab) | Collegiate jersey lettering, used sparingly so it reads as a detail, not a costume. |

- **Loading:** the fonts are loaded from Google Fonts with `display=swap`, and each one has a system fallback, so text is never invisible.
- **No new packages:** no new npm dependencies were added.

## 3. Colour

The palette is Yale-inspired but its own: navy, blue-grey neutrals, cream "paper" and a little gold. It keeps the project's default blue-grey style.

| Token | Value | Use |
|---|---|---|
| `--yale` | `#00356b` | Primary navy: buttons, links, the logo patch |
| `--yale-900` | `#0a1b33` | "Night" navy: promo bar, footer, chat header |
| `--slate-*` | `#f4f6f9` → `#33435a` | Blue-grey backgrounds, borders and secondary text |
| `--cream` / `--paper` | `#f7f1e3` / `#fbf8f1` | Photo mats, header, Dan's backdrop |
| `--gold` | `#d2a43a` | Accent only: underlines, the bag badge, sticker, stitches, focus rings |

- **Contrast:** body text is `--ink` or `--slate-700` on light backgrounds, and cream or white on navy, which passes WCAG AA.
- **Gold:** it's never used for small text on light backgrounds. Status colours (in stock, low stock, sold out) have their own tinted background plus a label, so colour is never the only signal.

## 4. Product photography: one look for black and white backgrounds

**The problem:** the 102 product photos are all square, but **73 have black backgrounds and 29 have white**.

**What I didn't do:** recolour the photos. Recolouring or blend modes would wash out the many navy garments against a navy backdrop.

**The solution:** a "print on a mat" frame, the `.print` component.

- **The mat:** each photo sits on a cream "paper" mat with a soft spotlight gradient and a faint stitched outline.
- **The print:** the photo itself has rounded corners, a **white print border**, a hairline and a soft drop shadow, so every image reads as a framed print in a gallery.
- **Why it works:** black and white backgrounds now feel like an intentional mix of prints rather than an inconsistent catalogue.
- **Used everywhere:** the same treatment appears on product cards, home category tiles, hero prints, the product-page zoom frame, bag thumbnails, and the mini-prints in chat cards.
- **On hover:** the print tilts slightly, like picking up a photo.
- **Untouched files:** the photo files themselves weren't changed.

## 5. Handsome Dan: the chatbot's personality

- **The character:** "Dan" is an **original cartoon bulldog drawn in SVG** (`src/brand/Dan.tsx`), inspired by Yale's bulldog mascot.
  - **Why drawn in code:** there was no mascot image in the project, and the project rules ask for mascots to be drawn in code.
  - **Bulldog features:** a wide flat head, folded "rose" ears, heavy jowls, a big nose, an underbite with two little fangs, a brindle patch, and a navy collar with a gold tag.
  - **Iteration:** the first draft looked like a bear and was redrawn.
- **Where he appears:**
  - **The chat:** he's the face of the assistant. The chat header reads "Dan · Campus Customs", he appears as a small avatar beside each reply, and the launcher says "Ask Dan".
  - **Typing:** while he's working, his head tilts ("Dan is sniffing around…").
  - **Elsewhere:** the "Meet Dan" band on Home, an "Ask Dan" button in the hero, and the 404 page ("Dan sniffed everywhere…").
- **His voice (system prompt):** the assistant is now named Dan, with a light touch of bulldog charm.
  - **Limits:** no barking, no repeated "woof", and the character never gets in the way of a clear answer.
  - **Honesty:** all honesty, tool and safety rules are unchanged.
- **Not overwhelming:** Dan never appears on product cards or in the grid, so the products stay the focus.

## 6. Layout and page-by-page changes

- **Header:** a cream glass bar (blurred, sticky) under a night-navy promo strip.
  - The links get a **gold underline** that grows in on hover or when active.
  - The **bag badge** is gold and does a small "bump" whenever the count changes.
- **Home:** an editorial page instead of a template.
  1. **Hero:** a large Fraunces headline with a gold-highlighted italic "*every*", a collage of three tilted product prints with handwritten-style captions, a gold "Est. on Broadway" sticker, and a stats row (live product count · XS–XXL · 57 Broadway).
  2. **Varsity ticker:** a band of categories scrolling slowly in Graduate type.
  3. **Shop by category:** tiles with a photo print and a student-life note ("Library nights", "Game day", "Family Weekend", "First snow"). They link into the Problem 9 search.
  4. **Featured gear** grid.
  5. **Collection band:** the original collection seal (gold rosette with a navy star and ring text "YALE CAMPUS COLLECTION ✦ NEW HAVEN ✦"), a one-line collection statement and three brand promises.
  6. **Meet Dan** band.
- **Products:** a navy banner with a stitched edge. The **search and filter bar floats over the banner** as a white card. The cards fade in with a slight stagger.
- **Product cards:** a print on a mat, the category in varsity caps, the name in Fraunces, the price with a gold underline, and a "View →" pill that slides up on hover.
- **Product detail:** a large print frame with the zoom kept, the price with a gold rule, a stock pill with a status dot, and a "Part of our Yale campus collection" badge with the small collection seal.
  - **Colours label:** now reads "Colors in this design", matching Problem 6's single-colourway rule.
  - **Size buttons:** varsity type, and sold-out sizes shown as **striped and crossed out**.
- **Bag:** each line has a print thumbnail. The summary card has a navy and gold varsity-stripe edge. The dashed-border notice still says clearly that this is not a checkout.
- **Log in / Create account:** a floating patch logo overlaps a card with a stitched inner border.
- **About:** a drop-cap story, and the visit card has a stitched border plus the collection seal and "Yale campus collection · New Haven".
- **Footer:** night navy with a subtle dot texture, the logo with cream text, the collection-seal badge, and a small "Boola boola ✦ Bulldogs" sign-off.
- **No Yale logo files:** the downloaded Yale wordmark and Y images used in the first version of this redesign were removed before publishing, because we have no documented permission to publish official Yale logos. They were replaced by an original Campus Customs **collection seal** (`src/brand/CampusSeal.tsx`, SVG), a gold stitched rosette with a navy star, which doesn't imitate any Yale mark. "Yale" now appears only as plain text where it's needed ("Yale campus collection"). Earlier wording that said "officially licensed" was also removed, because we have no documentation supporting that claim.

## 7. Interaction and motion

- **Navigation and cards:** pages fade and slide in on navigation. Product cards lift and their print tilts on hover, and cards cascade in when a grid loads.
- **Hero and logo:** the hero prints shift apart on hover, the sticker gently wobbles, and the logo's stitch "sews" on hover.
- **Chat:** messages slide in, Dan tilts while thinking, the launcher bounces in on page load, and the send arrow tips on hover.
- **Bag and links:** the badge bumps, and links get a gold underline sweep.
- **Accessible motion:** everything respects **`prefers-reduced-motion`**. Animations and transitions are reduced to nothing, and the ticker stops scrolling.

## 8. How it helps customers

- **Recognisable but distinct:** the store reads instantly as a Yale shop (navy, collegiate type, the bulldog, campus crests and wordmarks on the products), yet it has its own identity people can remember (the Stitched C, Dan).
- **Products look their best:** the consistent print frames make the catalogue look curated and trustworthy, so shoppers judge the garment, not the photo background.
- **Clear hierarchy:** product name, then price, then stock, then size, then "Add to bag".
- **Friendlier help:** Dan makes asking for help feel approachable, so more shoppers use the assistant that checks live stock and suggests alternatives.
- **Feels local:** small student touches (category notes, ticker, sticker, sign-off) make it feel like a real New Haven shop rather than a generic template.

## 9. Accessibility and responsive notes

- **Tested at 375 px:** no horizontal overflow on Home, Products, product page, Bag, Log in, Create account, About or 404.
  - **Phone adjustments:** the promo bar shortens, the tagline hides, and grids switch to 2 columns.
  - **Chat:** the panel fills the screen width, and the launcher becomes a round Dan button.
- **Labels and keyboard:**
  - Dan and the logo are decorative (`aria-hidden`) except where they're the main image (the Dan band has a title).
  - The launcher's label is "Chat with Dan, the shopping assistant".
  - Focus rings are a visible 3 px gold outline.
- **Tap targets:** size buttons, quantity buttons, filter buttons and chat cards are at least about 40 px.
- **Colour is never the only cue:** stock states use text ("Sold out", "Only 2 left") as well as colour and pattern.
- **Performance:** no new JavaScript dependencies. Dan, the Stitched C logo and the collection seal are inline SVG; the site uses no logo image files. The fonts are three families loaded with `display=swap`. The production build passes.
