import type { tutorial as en_tutorial } from '../en/tutorial';

export const tutorial: Record<keyof typeof en_tutorial, string> = {
  'tutorial.title': 'Zo speel je',
  'tutorial.subtitle': 'Een rondleiding van vijf minuten door Poule Position, met voorbeelden.',

  'tutorial.s1.title': 'Maak je account aan',
  'tutorial.s1.text':
    'Registreer met een bijnaam, je e-mailadres en een wachtwoord. Weet je niet welke naam je wilt? Gebruik **Verzin een F1-bijnaam** op het aanmeldformulier voor een racenaam die nog niemand heeft. Je kunt je bijnaam, e-mailadres en taal later wijzigen op je profielpagina.',

  'tutorial.s2.title': 'Bouw je grid',
  'tutorial.s2.text':
    'Open de homepage. Links staan de coureurs, rechts je grid. **Tik** op een coureur om hem in de volgende lege plek te zetten, of **sleep** hem naar precies de positie die je wilt. Tik op een gevulde plek om hem op te pakken en tik daarna op een andere plek om te wisselen. Voor een race vul je de hele top 10 in, voor een sprint de top 8.',
  'tutorial.s2.listLabel': 'Coureurs',
  'tutorial.s2.gridLabel': 'Jouw grid',
  'tutorial.s2.empty': 'Leeg',
  'tutorial.s2.caption': 'Voorbeeld: drie coureurs staan er, de vierde plek is aan de beurt.',
  'tutorial.s2.tip':
    'De lijst met coureurs volgt de kwalificatie-uitslag zodra die er is, zodat je ziet hoe de grid start. Daarvoor volgt hij de vorige race. Een link boven de grid toont de trainingsuitslagen.',

  'tutorial.s3.title': 'Kies de eerste uitvaller',
  'tutorial.s3.text':
    'Bij elke voorspelling voor een hoofdrace kies je ook één coureur waarvan je verwacht dat hij als **eerste uitvalt**. Zit je goed, dan krijg je een vaste **25 bonuspunten** bovenop je positiepunten. Elke coureur uit het veld mag, niet alleen je top 10. Bij sprints is er geen keuze.',
  'tutorial.s3.fieldLabel': 'Eerste uitvaller',
  'tutorial.s3.fieldHint': 'Verplicht · +25 ptn bij goed',

  'tutorial.s4.title': 'Dien in voor de start',
  'tutorial.s4.text':
    'Voorspellingen sluiten **1 minuut voor de start van de race**, voor alle spelers op hetzelfde moment. Tot die tijd kun je je voorspelling zo vaak aanpassen als je wilt, en je krijgt elke keer dat je indient een e-mail.',
  'tutorial.s4.t1': 'Doe je voorspelling',
  'tutorial.s4.t1v': 'Op elk moment voor het sluiten',
  'tutorial.s4.t2': 'Herinneringsmail',
  'tutorial.s4.t2v': '1 uur voor de start, als je nog niet hebt voorspeld',
  'tutorial.s4.t3': 'Voorspellingen sluiten',
  'tutorial.s4.t3v': '1 minuut voor de start',
  'tutorial.s4.forgot':
    'Vergeten te voorspellen? Je meest recente voorspelling, inclusief de keuze voor de eerste uitvaller, wordt overgenomen zodra de race sluit, en we mailen je wat er is ingevuld. Voor een sprint telt je laatste hoofdrace- of sprintvoorspelling.',

  'tutorial.s5.title': 'Sprintweekenden',
  'tutorial.s5.text':
    'In een paar weekenden is er op zaterdag een sprint naast de race op zondag. Elke is een eigen voorspelling: de sprint vraagt om de **top 8** en heeft geen keuze voor de eerste uitvaller. Gebruik de **Sprint / Hoofdrace**-schakelaar bovenaan de homepage om te wisselen, en kijk op de pagina Races welke weekenden een sprint hebben.',
  'tutorial.s5.sprint': 'Sprint',
  'tutorial.s5.main': 'Hoofdrace',

  'tutorial.s6.title': 'Na de race',
  'tutorial.s6.text':
    'Een paar minuten na de race krijg je een e-mail met de voorlopige uitslag en je punten. 24 uur later worden de definitieve punten berekend, zodra straffen en diskwalificaties zijn verwerkt, en je krijgt een bijgewerkte e-mail als je punten zijn veranderd. Je totaal komt in het klassement.',
  'tutorial.s6.spoiler':
    'E-mails met uitslagen beginnen met SPOILER ALERT in het onderwerp, zodat je ze ongeopend kunt laten tot je de race hebt gekeken.',

  'tutorial.score.title': 'Zo werken punten, met voorbeelden',
  'tutorial.score.intro':
    'Je scoort voor elke coureur die je plaatst. De punten komen van de positie die je **voorspelde**, volgens het puntensysteem van de Formule 1, en hangen af van hoe dichtbij de coureur finisht.',
  'tutorial.score.exact': 'Exacte positie',
  'tutorial.score.exactText': 'De volledige punten voor de positie die je voorspelde.',
  'tutorial.score.near': 'Eén positie ernaast',
  'tutorial.score.nearText': 'De helft van die punten, afgerond.',
  'tutorial.score.miss': 'Verder ernaast',
  'tutorial.score.missText': 'Geen punten, ook als de coureur buiten de punten-posities finisht.',
  'tutorial.score.scale': 'Punten per positie',
  'tutorial.score.scaleMain': 'Hoofdrace, top 10',
  'tutorial.score.scaleSprint': 'Sprint, top 8',

  'tutorial.example.title': 'Uitgewerkt voorbeeld',
  'tutorial.example.intro': 'Je voorspelde deze drie coureurs en de race eindigde zo:',
  'tutorial.example.colPredicted': 'Jij voorspelde',
  'tutorial.example.colFinished': 'Finish',
  'tutorial.example.colResult': 'Resultaat',
  'tutorial.example.colPoints': 'Punten',
  'tutorial.example.exact': 'Exact',
  'tutorial.example.near': 'Eén ernaast: de helft van 15, afgerond',
  'tutorial.example.miss': 'Drie posities ernaast',
  'tutorial.example.total': 'Totaal voor deze drie: **33 punten**, plus wat je andere zeven coureurs opleveren.',

  'tutorial.try.title': 'Probeer het zelf',
  'tutorial.try.intro': 'Kies een voorspelling en waar de coureur finishte om de punten te zien.',
  'tutorial.try.race': 'Soort race',
  'tutorial.try.predicted': 'Jij voorspelde positie',
  'tutorial.try.finished': 'De coureur finishte',
  'tutorial.try.outside': 'Buiten de top {n}',
  'tutorial.try.bonus': 'Mijn keuze voor de eerste uitvaller was goed (+25)',
  'tutorial.try.pt': '{n} punt',
  'tutorial.try.pts': '{n} punten',
  'tutorial.try.exact': 'Exacte positie: de volledige {pts} voor P{p}.',
  'tutorial.try.nearWhole': 'Eén positie ernaast: de helft van {base} is {pts}.',
  'tutorial.try.nearRounded': 'Eén positie ernaast: de helft van {base} is {half}, afgerond op {pts}.',
  'tutorial.try.miss': 'Te ver ernaast, dus geen punten.',
  'tutorial.try.total': 'Totaal: {pts}',

  'tutorial.cta.title': 'Klaar om te spelen?',
  'tutorial.cta.register': 'Maak je account aan',
  'tutorial.cta.predict': 'Doe je voorspelling',
  'tutorial.cta.rules': 'Lees alle regels',
};
