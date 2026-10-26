# Group play (private poules) — design

Status: draft for the owner's approval. Nothing is built yet.

## Why

Today every player is in one poule with one standings table. Friend groups want their own: their own
standings, a link to hand to friends, and still the same simple game. The owner wants this in place
**before the next season starts (March 2027)** and wants it **running during the current season** so it
can be tested for real. The season has five races left (Mexico City 1 Nov, São Paulo 8 Nov, Las Vegas
22 Nov, Qatar 29 Nov, Abu Dhabi 6 Dec). So: small steps, a first version that works end to end for one
test group as early as practical, then refine.

## What it is

Words and decisions are the owner's unless marked **(my call)**.

**Groups.** A group is a named poule with its own standings. Scoring, deadlines and the way you predict
do not change. There is one prediction per player per race, and it counts everywhere that player plays.

**Who can start a group.** Only players the owner picks. In the Pitlane user list each player gets a
switch "Can start groups" (like the Pit Wall switch), off by default. Players with it on see a "Start a
group" button. Everyone else can still join groups through a link. **(my call)** A player with the switch
can start several groups. **(my call)** There is no size limit while this is being tested.

**The invite.** The starter gets one secret link per group (for example `pouleposition.nl/join/…`) and
shares it themselves, with a Share button that works like the one in the header (WhatsApp and so on).
The app never emails invites. **(my call)** The link can be used by many people until the starter presses
"New link", which stops the old link and makes a new one. **(my call)** Only the starter sees the link.

**Joining.**
- Someone who already has an account logs in, sees "Join *group name*?", and accepts.
- A new player registers first (the normal sign-up). The sign-up page says they are joining a group, and
  tells them they can choose to play in the main poule as well or only in the group.
- Everyone who joins through a link makes that choice ("also play in the main poule", yes or no).
  **(my call)** The box starts ticked ("yes"), which matches how everyone plays today.
  **(my call)** A player can change it later on their Profile page, and the existing players can use that
  switch too.
- A player who is already in the group just sees "you are already in".
- **New players** land on How to Play after registering, with a banner "You joined *group name*". That is
  the tutorial referral. They also get the normal welcome email, with one extra line naming the group.
  **(my call)** Existing players who join land on the group's standings.

**The main poule.** Everyone who registers the normal way, without a link, plays in the main poule exactly
as today, and the existing players stay in it untouched. A player who chose "only in the group" does not
appear on the main Standings page, the main season replay, the main player stats or other lists that cover
the main poule (for example the top scorers on the Stats page). Their points and predictions are the same
as before.

**Standings.** The Standings page gets a "which poule" choice: one entry per poule the player is in: the
main poule (if they play in it) and each group. **(my call)** A player who plays only in a group does not
see the main poule at all, the same way they are not in it. Everything on that page follows it: the standings table, the season replay and the
player stats. **(my call)** Group standings use each member's whole-season points, like the main poule,
including races before they joined, because predictions are the player's own. **(my call)** The other
pages (Stats, Races, My Predictions) stay as they are in the first version.

**What members see of each other.**
- Standings and points: always, within a poule.
- Each other's predictions: **once the race has started**, within the poule you are looking at. This is
  also new for the main poule: today players only see their own. **(my call)** "Started" means the moment
  predictions lock (one minute before lights out, `PREDICTION_LOCK_MINUTES`).
- Never before that. Email addresses are never shown to anyone (see `decisions.md`, privacy).

**Managing a group.** The starter can rename the group, see the members (nicknames only), remove a member,
make a new link, and delete the group. **(my call)** A member can leave a group. **(my call)** The owner of
the site can see every group, with its starter and members, in the Pitlane, and can remove a member or
delete a group. **(my call)** If a starter deletes their account, the group stays and the site owner is
asked to reassign it (it shows in the Pitlane); members are not kicked out. Deleting an account removes
that person's memberships.

**Groups across seasons.** **(my call)** A group stays when the season changes in January; the standings
show the current season, like the main poule. **(my call)** Group names do not have to be unique (the link
identifies the group), 3 to 40 characters.

**Emails.** Result emails, reminders and the welcome email stay as they are, apart from the one extra
line in the welcome email. **(my call)** No group rank in result emails in the first version.

## Goals

- A friend group can compete in its own standings with a link and no admin work per member.
- Nothing changes for the existing 12 players unless they choose it.
- Works on a phone and in both languages from the first version.

## Non-goals

Separate predictions per group, custom scoring or rules per group, chat or comments, emailed invites, a
public list of groups, season predictions, changing what the other pages show.

## Anti-goals (a failure even if it technically works)

- A stranger can find a group, or see who is in it, without the link (so the link must be unguessable and joining rate-limited).
- Anyone's email address becomes visible to another player.
- Anyone's points or ranking in the main poule change without them choosing it.
- A player's prediction becomes visible to others before the race starts.
- A member's opt-out of the main poule leaks them back into main-poule lists.

## Constraints from the project

Follow `decisions.md`: English and Dutch for every string, the brand look, a check at 320 px, no
addresses on screen or in logs, nothing sent to players without the owner's yes, test with throwaway
accounts and delete them afterwards, idempotent migrations, the deploy steps there. Points keep coming
from `predictions.points_earned` and `sprint_predictions.points_earned`; `users.total_points` stays the
season total. The Pit Wall item "Group / team play" is updated when this is built.

## Left to the builder

The database layout, route names, the exact link format and its randomness (it must be unguessable), the
screens and wording (brand look, both languages), how the Standings selector looks on a phone, how
"predictions once started" is shown, the order of the build steps, and how to test.
