# Weekend flags: news that probably changes predictions

Status: approved by the owner in chat on 2026-10-31 ("all good, please build").

## Why

During the 2026 Mexico City weekend Haas replaced Ocon with Hirakawa and Cadillac's Bottas took a
50-place grid drop. Both changed what a good prediction looks like, and the app learned of neither:
Hirakawa was missing from the driver table (found by chance) and nobody was told about the penalty.
The owner wants to be made aware of such news, not have the app decide what to do about it.

## What it is

A race-weekend watcher that reads the FIA's official decision documents and flags the ones that
**probably influence predictions**. A flag goes to the owner (admin) only. Players see nothing.
The watcher never changes predictions, scoring or the driver list.

## Sources

- **FIA decision documents page** (`fia.com/documents/championships/fia-formula-one-world-championship-14`),
  the first, expanded event block: title, PDF link and publication time (CET) per document. Reachable
  with a plain request. The PDFs are text, read with `pdftotext -layout`.
- **F1's live feed** (already connected), second detector: at the start of a qualifying or race
  session its driver list is compared with our drivers table.

## Behaviour

1. **Window.** The watcher runs every 10 minutes (cron) but only does work from 6 days before a main
   race until its prediction lock (the main race start minus `PREDICTION_LOCK_MINUTES`). Documents
   published before the window opens are ignored, so the previous event's papers never count.
2. **Memory.** Every document seen is stored in `fia_documents` (URL is the key), so a redeploy
   forgets nothing and a document is flagged once.
3. **What gets read.** Titles decide: driver changes, revised entry lists, infringements, decisions,
   summons and power-unit reports are read. Classifications, notes, timetables, scrutineering,
   lap-time deletions and the rest are stored as `skipped`.
4. **Severity.** `flag` = probably influences predictions: a driver change, a grid drop (with the
   number of places), a pit-lane start, a disqualification or exclusion, or a driver-list difference
   from the live feed. `seen` = stored and listed in the Pitlane, never emailed (warnings, fines,
   summons, entry lists, PU reports, routine reports).
5. **Fail-safe.** A driver-change document is flagged from its title alone. An infringement or
   decision whose text cannot be read or understood is retried on the next runs and flagged after
   three attempts, with a link to the PDF, rather than ignored.
6. **Driver changes** also say whether the stand-in is missing from our drivers table and point to
   the Pitlane card "Drivers not racing". Nothing is done automatically.
7. **Email.** New flags are mailed to `ADMIN_EMAIL` in one English email per run: what happened, the
   driver, the places, the document link and the time in Dutch time. A mail that fails to send is
   retried by the next run (`flag_emailed_at` stays empty).
8. **Pitlane card "Race weekend flags":** the latest documents, flags first, with a "Check now"
   button, the time of the last check, and a failure notice.
9. **The watcher watching itself.** Each run is recorded in `fia_checks`. Three failed runs in a row
   inside the window send the owner one "watcher is failing" email.
10. **Live-feed detector.** At the start of a Qualifying or Race session (not practice: stand-ins
    drive Friday sessions all the time) a driver number in the feed that our drivers table lacks, or a
    driver of ours that is absent from the feed, creates a `flag` row (source `feed`), emailed by the
    next run.

## Non-goals

- No player-facing alerts, no automatic changes, no general news search (it proved unreliable).
- No flags after the race has locked: penalties after the start do not change predictions.
- No judgement of "how much" a penalty matters beyond its size.

## Parsing facts (from real 2026 Mexico documents)

- Driver change: "change the driver of car 31, Esteban Ocon" and "the driver, Ryo Hirakawa, with the
  car number 50, to participate ... in place of Esteban Ocon". No reason is given, so none is claimed.
- Infringement / decision: a `No / Driver  77 - Valtteri Bottas` line, then `Decision  Drop of 50 grid
  positions for the next Race ...`, written in words for small numbers ("A drop of one grid position").
  Formal warnings and fines are `seen`.
- Document times in the PDFs are circuit-local; the listing's times are CET and are what is stored.

## Decisions I made (owner may overrule)

- Window, 10-minute cadence and the three-attempt rule are mine.
- `poppler-utils` is added to the Docker image for text extraction instead of an npm PDF library: one
  small system tool, no new JavaScript dependency.
- English-only email, since it goes to the owner.
