# Underline

Swipe through the best ideas from books: finance sector by sector, science, history and warriors, philosophy, psychology, strategy and habits. It installs on your phone's home screen, works offline, and keeps saved cards on your device.

## Put it online for free (GitHub Pages, about 10 minutes)

1. Create a free account at github.com.
2. Click **New repository**, name it `underline`, set it to **Public**, and create it.
3. On the empty repo page, click **uploading an existing file**. Drag in everything from this folder (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `.nojekyll`, and the `icons` and `data` folders), then click **Commit changes**.
4. Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
5. After a minute or two your app is live at `https://<your-username>.github.io/underline/`.

## Install it on your phone

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → menu → **Install app**.

It opens full-screen from the icon and works offline after the first load.

## How new books get added

The library lives in `data/`:

- `libraries.json` holds the libraries, shelves (sectors) and suggested reads.
- `index.json` lists the book files to load.
- `books-*.json` hold the books. Each book is `{id, title, author, color, library, shelf, order, cards: [{type: "idea" | "quote", text, meaning, apply}]}`.

To add books, drop a new `books-YYYY-MM-DD.json` into `data/` and add its name to `index.json`. The app picks it up on next launch. Once GitHub is connected to Claude, the weekly scheduled task can commit these files for you.

## Full books

`data/texts/` holds complete public-domain books (from Standard Ebooks) in reader format: `{title, author, translator, source, chapters:[{title, paras:[...]}]}`. A paragraph starting with `§ ` is a subheading. `data/texts/index.json` maps book ids (`books`) and normalised titles (`titles`) to files, with `meta` for the Full books list. To add one: `git clone --depth 1 https://github.com/standardebooks/<repo>` then `python3 -I tools/se2json.py <repo> data/texts/<name>.json` and add it to the index. Copyrighted books are never included; the app links to free library borrowing instead.

## Content notes

Ideas are summarised in original words. Quotes are short, and quotes from copyrighted books are limited. Public-domain books are marked Free and link to Project Gutenberg.
