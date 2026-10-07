// Wording for the emails players receive, in English and Dutch. The language is
// the player's saved choice (users.language); a player who never chose gets
// English, which is what every email used before this existed.
//
// Placeholders are {name}-style. Values passed in must already be HTML-safe
// (use escapeHtml, or wrap in <strong>) — nothing here escapes them.

export type EmailLang = 'en' | 'nl';

export const normalizeLang = (value: unknown): EmailLang => (value === 'nl' ? 'nl' : 'en');

const en = {
  'common.hello': 'Hello {name}!',
  'common.goodLuck': 'Good luck! 🏎️',
  'common.seeYou': 'See you at the next race! 🏎️',
  'common.viewLeaderboard': 'View Leaderboard',
  'common.submitPrediction': 'Submit Prediction',
  'common.visit': 'Visit Poule Position',
  'common.unsubscribe': 'Unsubscribe from announcement emails',
  'common.dnf': 'DNF',
  'common.pts': 'pts',

  'predConfirm.subject': 'Prediction Confirmed - {race}',
  'predConfirm.title': 'Prediction Confirmed!',
  'predConfirm.intro': 'Your prediction for {race} has been saved:',
  'predConfirm.dnf': 'First retirement pick: {name} (+25 pts if correct)',
  'predConfirm.update': 'You can update your prediction until 1 minute before the race starts.',

  'provisional.subject': 'Race Results - {race} (Provisional)',
  'provisional.title': 'Provisional Race Results',
  'provisional.intro': 'The {race} has finished! Here are the provisional results:',
  'provisional.top10': 'Race Results (Top 10)',
  'provisional.pos': 'Pos',
  'provisional.driver': 'Driver',
  'provisional.points': 'Points',
  'provisional.yourResults': 'Your Prediction Results',
  'provisional.total': 'Your Total Points: {points}',
  'provisional.note':
    'Note: These are provisional results. Final points will be calculated 24 hours after the race to account for any disqualifications or penalties.',

  'final.subject': 'Final Results - {race}',
  'final.title': 'Final Race Results Confirmed',
  'final.intro': 'The final results for {race} have been confirmed.',
  'final.updatedTitle': 'Results Updated!',
  'final.updatedText': 'Due to post-race penalties/disqualifications, your points have changed:',
  'final.updatedChange': 'Previous: {previous} points → Final: {final} points',
  'final.yourResults': 'Your Prediction Results',
  'final.total': 'Your Final Points: {points}',

  'raceReminder.subject': 'Reminder: {race} - Submit Your Prediction!',
  'raceReminder.title': 'Race Day Reminder!',
  'raceReminder.text': '{race} is coming up on {date}!',
  'raceReminder.dont': "Don't forget to submit your prediction before the race starts.",

  'missed.subject': '1 Hour Left — Submit Your Prediction for {race}!',
  'missed.banner': '1 Hour To Lights Out',
  'missed.title': "Don't Miss Out!",
  'missed.bodyRace': "You haven't submitted a prediction yet for {race}, and it locks in about 1 hour.",
  'missed.bodySprint': "You haven't submitted a sprint prediction yet for {race}, and it locks in about 1 hour.",
  'missed.fallback':
    "If you don't submit in time, your last prediction will be copied in automatically — so get your own picks in while you still can!",

  'autofill.subject': 'We Filled In Your Prediction - {race}',
  'autofill.banner': 'Prediction Auto-Filled',
  'autofill.title': "You Didn't Predict In Time",
  'autofill.intro':
    '{race} locked before you submitted a prediction, so we copied in your picks from your last race to keep you in the game:',
  'autofill.nothing': "Nothing to do now — this prediction is locked in for this race. Don't forget to submit your own next time!",

  'resultsIn.subject': 'The results are in! - {race}',
  'resultsIn.title': 'The results are in!',
  'resultsIn.text': 'The final results for {race} have been processed and the leaderboard has been updated.',
  'resultsIn.check': 'Check out where you stand!',

  'personal.subjectRace': 'Your Race Predictions — {race}',
  'personal.subjectSprint': 'Your Sprint Race Predictions — {race}',
  'personal.titleRace': 'Your Race Predictions',
  'personal.titleSprint': 'Your Sprint Race Predictions',
  'personal.intro': "Here's how your prediction for {race} compared to the actual result:",
  'personal.legend': 'A gold points value means an exact match; a ★ means a near miss (±1 position, half points).',
  'personal.earned': 'Points earned this race: {points}',
  'personal.season': 'Season total: {points} pts',

  'broadcast.subject': 'Poule Position - {subject}',

  'reset.subject': 'Reset your Poule Position password',
  'reset.banner': 'Reset Your Password',
  'reset.intro':
    'Someone asked to reset the password for your Poule Position account. Use the button above to choose a new one. The link works for 1 hour and only once.',
  'reset.fallback': 'Button not working? Paste this link into your browser:',
  'reset.ignore': "If you didn't ask for this, you can ignore this email. Your password stays the same.",

  'unsub.back': 'Back to Poule Position',
  'unsub.invalid': 'This unsubscribe link is invalid.',
  'unsub.expired': 'This unsubscribe link is invalid or has expired.',
  'unsub.done':
    "You've been unsubscribed from Poule Position announcement emails. You'll still get emails about your own predictions and results.",
  'unsub.error': 'Something went wrong. Please try again later.',

  'welcome.subject': 'Welcome to Poule Position, {name}!',
  'welcome.banner': 'Welcome On The Grid',
  'welcome.intro':
    'Your account is ready. Poule Position is a Formula 1 prediction game: before every race you predict the finishing order and score points for every driver you get right. Then see how you stack up against your friends on the season leaderboard.',
  'welcome.how.title': 'How it works',
  'welcome.how.1': 'Open a race and drag the drivers into the order you expect them to finish: the top 10 for a race, the top 8 for a sprint.',
  'welcome.how.2': 'Submit before the deadline. Predictions lock 1 minute before lights out, and until then you can change them as often as you like.',
  'welcome.how.3': 'After the race you get an email with the results and your points. The final points follow 24 hours later, once any penalties are settled.',
  'welcome.scoring.title': 'Scoring in short',
  'welcome.scoring.exact': 'Right position: the full Formula 1 points for that position, from 25 for P1 down to 1 for P10.',
  'welcome.scoring.near': 'One position off: half the points.',
  'welcome.scoring.miss': 'Further off, or outside the top 10: no points.',
  'welcome.scoring.dnf': 'Bonus: pick which driver will retire first in a main race and earn +25 points if you are right. This pick is optional.',
  'welcome.scoring.sprint': 'On sprint weekends there is a separate sprint prediction for the top 8, worth 8 points for P1 down to 1.',
  'welcome.forgot':
    "Forgot to predict? We copy in your most recent prediction when the race locks and tell you what was entered. You also get a reminder 1 hour before lights out if you haven't predicted yet.",
  'welcome.profile': 'You can change your nickname, email and language any time on your profile page.',
  'welcome.cta': 'Make Your First Prediction',
  'welcome.rules': 'The full rules are on the website:',
  'welcome.rulesLink': 'Read the rules',
  'welcome.questions': 'Questions? Just reply to this email.',
  'welcome.late':
    'Sorry this email took a while. A normal pit stop takes about two seconds; our welcome email took a few days. The mechanic was busy tinkering with the website. Better late than never: here is your welcome after all.',
};

export type EmailKey = keyof typeof en;

const nl: Record<EmailKey, string> = {
  'common.hello': 'Hallo {name}!',
  'common.goodLuck': 'Succes! 🏎️',
  'common.seeYou': 'Tot de volgende race! 🏎️',
  'common.viewLeaderboard': 'Bekijk het klassement',
  'common.submitPrediction': 'Doe je voorspelling',
  'common.visit': 'Bezoek Poule Position',
  'common.unsubscribe': 'Afmelden voor aankondigingsmails',
  'common.dnf': 'DNF',
  'common.pts': 'ptn',

  'predConfirm.subject': 'Voorspelling bevestigd - {race}',
  'predConfirm.title': 'Voorspelling bevestigd!',
  'predConfirm.intro': 'Je voorspelling voor {race} is opgeslagen:',
  'predConfirm.dnf': 'Gekozen eerste uitvaller: {name} (+25 ptn als het klopt)',
  'predConfirm.update': 'Je kunt je voorspelling aanpassen tot 1 minuut voor de start van de race.',

  'provisional.subject': 'Raceuitslag - {race} (voorlopig)',
  'provisional.title': 'Voorlopige raceuitslag',
  'provisional.intro': 'De {race} is afgelopen! Hier is de voorlopige uitslag:',
  'provisional.top10': 'Raceuitslag (top 10)',
  'provisional.pos': 'Pos',
  'provisional.driver': 'Coureur',
  'provisional.points': 'Punten',
  'provisional.yourResults': 'Jouw voorspelling',
  'provisional.total': 'Jouw totaal aantal punten: {points}',
  'provisional.note':
    'Let op: dit is de voorlopige uitslag. De definitieve punten worden 24 uur na de race berekend, zodat diskwalificaties en straffen worden meegenomen.',

  'final.subject': 'Definitieve uitslag - {race}',
  'final.title': 'Definitieve raceuitslag bevestigd',
  'final.intro': 'De definitieve uitslag van {race} is bevestigd.',
  'final.updatedTitle': 'Uitslag bijgewerkt!',
  'final.updatedText': 'Door straffen of diskwalificaties na de race zijn je punten veranderd:',
  'final.updatedChange': 'Eerder: {previous} punten → Definitief: {final} punten',
  'final.yourResults': 'Jouw voorspelling',
  'final.total': 'Jouw definitieve punten: {points}',

  'raceReminder.subject': 'Herinnering: {race} - Doe je voorspelling!',
  'raceReminder.title': 'Racedag-herinnering!',
  'raceReminder.text': '{race} staat voor de deur op {date}!',
  'raceReminder.dont': 'Vergeet niet je voorspelling te doen voordat de race begint.',

  'missed.subject': 'Nog 1 uur — doe je voorspelling voor {race}!',
  'missed.banner': 'Nog 1 uur tot de start',
  'missed.title': 'Mis het niet!',
  'missed.bodyRace': 'Je hebt nog geen voorspelling gedaan voor {race}, en die sluit over ongeveer 1 uur.',
  'missed.bodySprint': 'Je hebt nog geen sprintvoorspelling gedaan voor {race}, en die sluit over ongeveer 1 uur.',
  'missed.fallback':
    'Als je niet op tijd voorspelt, wordt je laatste voorspelling automatisch overgenomen — dus zet nu je eigen keuzes in!',

  'autofill.subject': 'We hebben je voorspelling ingevuld - {race}',
  'autofill.banner': 'Voorspelling automatisch ingevuld',
  'autofill.title': 'Je voorspelde niet op tijd',
  'autofill.intro':
    '{race} sloot voordat je een voorspelling had gedaan, dus hebben we je keuzes van je vorige race overgenomen zodat je in het spel blijft:',
  'autofill.nothing': 'Je hoeft niets meer te doen — deze voorspelling staat vast voor deze race. Vergeet de volgende keer niet zelf te voorspellen!',

  'resultsIn.subject': 'De uitslag is binnen! - {race}',
  'resultsIn.title': 'De uitslag is binnen!',
  'resultsIn.text': 'De definitieve uitslag van {race} is verwerkt en het klassement is bijgewerkt.',
  'resultsIn.check': 'Kijk waar je nu staat!',

  'personal.subjectRace': 'Jouw racevoorspelling — {race}',
  'personal.subjectSprint': 'Jouw sprintvoorspelling — {race}',
  'personal.titleRace': 'Jouw racevoorspelling',
  'personal.titleSprint': 'Jouw sprintvoorspelling',
  'personal.intro': 'Zo deed je voorspelling voor {race} het ten opzichte van de echte uitslag:',
  'personal.legend': 'Gouden punten betekent een exacte treffer; een ★ betekent bijna goed (±1 positie, halve punten).',
  'personal.earned': 'Punten deze race: {points}',
  'personal.season': 'Seizoenstotaal: {points} ptn',

  'broadcast.subject': 'Poule Position - {subject}',

  'reset.subject': 'Reset je Poule Position-wachtwoord',
  'reset.banner': 'Reset je wachtwoord',
  'reset.intro':
    'Iemand heeft gevraagd het wachtwoord van je Poule Position-account te resetten. Gebruik de knop hierboven om een nieuw wachtwoord te kiezen. De link werkt 1 uur en maar één keer.',
  'reset.fallback': 'Werkt de knop niet? Plak deze link in je browser:',
  'reset.ignore': 'Heb je dit niet aangevraagd? Dan kun je deze e-mail negeren. Je wachtwoord blijft hetzelfde.',

  'unsub.back': 'Terug naar Poule Position',
  'unsub.invalid': 'Deze afmeldlink is ongeldig.',
  'unsub.expired': 'Deze afmeldlink is ongeldig of verlopen.',
  'unsub.done':
    'Je bent afgemeld voor de aankondigingsmails van Poule Position. Je krijgt nog wel e-mails over je eigen voorspellingen en uitslagen.',
  'unsub.error': 'Er ging iets mis. Probeer het later nog eens.',

  'welcome.subject': 'Welkom bij Poule Position, {name}!',
  'welcome.banner': 'Welkom op de grid',
  'welcome.intro':
    'Je account staat klaar. Poule Position is een Formule 1-voorspelspel: voor elke race voorspel je de uitslag en verdien je punten voor elke coureur die je goed hebt. Kijk daarna hoe je het doet tegenover je vrienden in het seizoensklassement.',
  'welcome.how.title': 'Zo werkt het',
  'welcome.how.1': 'Open een race en sleep de coureurs in de volgorde waarin je verwacht dat ze finishen: de top 10 voor een race, de top 8 voor een sprint.',
  'welcome.how.2': 'Dien je voorspelling in voor de deadline. Voorspellingen sluiten 1 minuut voor de start, en tot die tijd kun je ze zo vaak aanpassen als je wilt.',
  'welcome.how.3': 'Na de race krijg je een e-mail met de uitslag en je punten. De definitieve punten volgen 24 uur later, zodra eventuele straffen zijn verwerkt.',
  'welcome.scoring.title': 'Puntentelling in het kort',
  'welcome.scoring.exact': 'Juiste positie: de volledige Formule 1-punten voor die positie, van 25 voor P1 tot 1 voor P10.',
  'welcome.scoring.near': 'Eén positie ernaast: de helft van de punten.',
  'welcome.scoring.miss': 'Verder ernaast, of buiten de top 10: geen punten.',
  'welcome.scoring.dnf': 'Bonus: kies welke coureur als eerste uitvalt in een hoofdrace en verdien +25 punten als je gelijk hebt. Deze keuze is optioneel.',
  'welcome.scoring.sprint': 'In sprintweekenden is er een aparte sprintvoorspelling voor de top 8, goed voor 8 punten voor P1 tot 1.',
  'welcome.forgot':
    'Vergeten te voorspellen? Wij nemen je meest recente voorspelling over zodra de race sluit en laten je weten wat er is ingevuld. Je krijgt ook een herinnering 1 uur voor de start als je nog niet hebt voorspeld.',
  'welcome.profile': 'Je kunt je bijnaam, e-mailadres en taal op elk moment wijzigen op je profielpagina.',
  'welcome.cta': 'Doe je eerste voorspelling',
  'welcome.rules': 'De volledige regels staan op de website:',
  'welcome.rulesLink': 'Lees de regels',
  'welcome.questions': 'Vragen? Beantwoord gewoon deze e-mail.',
  'welcome.late':
    'Sorry dat dit bericht er even over deed. Een gewone pitstop duurt ongeveer twee seconden; onze welkomstmail deed er een paar dagen over. De monteur had het te druk met sleutelen aan de website. Beter laat dan nooit: hier is alsnog je welkom.',
};

const dictionaries: Record<EmailLang, Record<EmailKey, string>> = { en, nl };

export const et = (lang: EmailLang, key: EmailKey, vars?: Record<string, string | number>): string => {
  let text = dictionaries[lang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
};
