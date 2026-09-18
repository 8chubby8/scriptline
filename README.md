# Scriptline

An interactive timeline study aid that sets Bible history alongside world history.

**Open Scriptline: https://8chubby8.github.io/scriptline/**

Scriptline starts blank. You research and build your own timeline, at your own pace, following your own chronology. Nothing is pre-loaded, and nobody else's dates are imposed on you.

> This is an early test version. It works best on a computer. On a phone you'll see a list of your entries instead of the timeline.

---

## Getting started

1. Open the link above in your web browser. There's nothing to install and no account to create.
2. The first time, the timeline is empty. You can:
   - click **Add your first entry** to start your own timeline, or
   - click **Try it with sample entries** to explore with about 20 example entries. You can remove them all later from **Settings**.

## Using it without the internet

The link above is the easiest way to use Scriptline, and it always has the latest version. If you'd rather keep your own copy on your computer:

1. At the top of this GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip the downloaded file. On Windows, right-click it and choose **Extract All**. Opening it without extracting won't work properly.
3. Open the unzipped folder and double-click **`index.html`**. Scriptline opens in your web browser.

Good to know:

- **Keep the files together.** `index.html` needs the `css` and `js` folders beside it. The other files (the `.md` files) are just notes and can be ignored.
- **Your copy won't update itself.** To get a newer version, download the ZIP again and use it to replace your old folder, keeping the same folder name and location. Your entries are kept in your browser rather than in the folder, but some browsers link them to the folder's location, so keeping the name and location the same makes sure they're still there.
- **The website and your downloaded copy keep separate entries.** Entries made on one won't appear on the other. It's best to pick one and stick with it, though you can move entries between them with a backup.

## Finding your way around

**Biblical history** runs across the top half of the screen and **world history** across the bottom half. A date ruler runs between them, so events from both sides that happened at the same time line up one above the other.

- **Zoom:** scroll the mouse wheel, pinch on a trackpad, or use the **+** and **−** buttons.
- **Move around:** click and drag.
- **See everything:** click **Fit all**.
- **Keyboard:** **+** and **−** zoom, the arrow keys move, and **F** fits all.

As you zoom in, more detailed entries fade into view on rows next to the ruler, pushing the broader entries outward. Whichever level of detail is newest on screen is drawn larger. Zoom back out and the detailed entries fade away again, while the broad entries stay.

## Reading an entry

Click any entry on the timeline to open its card. The card shows:

- a banner picture and the entry's dates
- **What happened**, a summary
- **Within this**, the more detailed entries that belong to it
- **Research notes**, your dated notes with the newest first. Click **+ Add note** to write one.
- **Gallery**, pictures with captions and credits. Click a picture to see it larger.
- **Sources**, where your information came from, with links where you've added them

Click **← Back to timeline** (or press **Esc**) to return to exactly where you were.

## Adding and editing entries

Click **+ New entry** at the top, or **Edit** on any card. Reading and editing are kept separate, so you can't change something by accident while browsing.

- **Title:** a short name, shown on the timeline.
- **Part of (parent):** optional. Choose a broader entry this one belongs to, such as an event within a king's reign.
- **Tier:** how broad the entry is, from **1** (broadest, such as a kingdom or empire) to **4** (most specific, such as a single moment). Tier decides which row it sits on and how far you need to zoom in before it appears. Choosing a parent fills this in for you.
- **Track:** biblical or world history.
- **Colour:** each family of entries shares one colour, set on its top entry. Entries within a family take that colour automatically.
- **Dates:** enter the year and choose BCE or CE. You can add a month or an exact day if you know them. Tick **Approximate** for uncertain dates. These are drawn with a soft, fading edge so you can see at a glance which dates are firm. The end date is optional; leave it off for a single event, or when the end is unknown.
- **Pictures, notes and sources** can all be added, changed or removed here.

## Finding an entry

Click **List** to see every entry as a searchable list. You can filter it by track and sort it by date, by title, or by what you changed most recently. Click an entry in the list to jump to it.

## Settings

- **Date notation:** show dates as **BCE / CE** or **BC / AD**. This only changes how dates are displayed; your entries aren't altered.
- **Backup:** save your entries to a file, or restore them from one (see below).
- **Remove sample entries:** clears out the examples and keeps anything you've added yourself.

## Where your entries are kept

Everything you enter is saved **in your own web browser, on your own computer**. Nothing is sent anywhere, and nobody else can see it.

This means:

- your timeline stays on the computer and browser where you made it
- **clearing your browser's data will erase your entries**, so save backups regularly (see below)

## Backing up and restoring

**To save a backup:** open **Settings** and click **Save a backup**. A single file, such as `scriptline-backup-2026-09-18.zip`, goes to your Downloads folder. It holds all your entries and pictures. Keep it somewhere safe: a USB stick, cloud storage, or email it to yourself. Settings shows when you last saved one.

**To restore:** open **Settings**, click **Restore from a backup…** and choose the backup file. Scriptline tells you what's in it and asks how to restore:

- **Merge** puts the backup's entries back and keeps anything you've added since. Where an entry is in both, the backup's version is used. This is the safe everyday choice.
- **Replace everything** deletes what's currently in Scriptline and puts back exactly what's in the backup. Use this when moving to a new computer or starting over.

**Moving to another computer or browser:** save a backup on the old one, then restore it on the new one.

## What's coming

See [ROADMAP.md](ROADMAP.md) for planned work and [CHANGELOG.md](CHANGELOG.md) for what's changed.
