import { Newsletter } from './types';

// November 2026: "Did you know?", a tour of the site on a phone. The phone has one way around: the
// menu button at the top left (there is no bar along the bottom of the screen). Every menu item is
// named exactly as the site spells it (checked by a test against the drawer's labels).
export const didYouKnowNov2026: Newsletter = {
  en: {
    subject: 'Did you know? Finding your way around on your phone',
    banner: 'Did you know?',
    intro:
      'Poule Position works on your phone, and everything is one tap away. Here is a short tour: what you find at the top of the screen, what is in the menu and what each page is for.',
    sections: [
      {
        title: 'At the top of every page',
        items: [
          {
            title: 'Menu',
            text: 'The square button with three lines, top left, opens the menu with every page of the site. Tap the cross, or anywhere outside the menu, to close it.',
          },
          {
            title: 'Logo',
            text: 'Tap the logo to go back to the home page, wherever you are.',
          },
          {
            title: 'EN | NL',
            text: 'Switch the site between English and Dutch.',
          },
          {
            title: 'Share',
            text: 'Send your friends a link to the game.',
          },
          {
            title: 'Your picture or initial',
            text: 'Top right. It opens your profile, where you change your picture, nickname, email, language or password.',
          },
        ],
      },
      {
        title: 'In the menu',
        items: [
          {
            title: 'Home',
            text: 'The next race with a countdown, and the place where you make your prediction.',
          },
          {
            title: 'Race Overview',
            text: 'The season calendar. Tap a race to see every session of that weekend with the start times in Dutch time.',
          },
          {
            title: 'Drivers',
            text: "The Drivers' Championship: where every driver stands.",
          },
          {
            title: 'Teams',
            text: 'The teams with their drivers and power units.',
          },
          {
            title: 'Championship',
            text: 'The standings of the players. Slide through the season race by race to watch the standings change.',
          },
          {
            title: 'Groups',
            text: 'Play against your own friends. Everyone predicts as usual and each group has its own standings. You join a group through the link its starter shares, and only players Kimi has switched on can start one.',
          },
          {
            title: 'My Predictions',
            text: 'Every prediction you made, race by race, with the points each pick earned. Races that have not started yet have an Edit button.',
          },
          {
            title: 'Statistics',
            text: 'Season highlights and fun facts about the players, plus the results of qualifying, the sprint and the race.',
          },
          {
            title: 'News',
            text: "The latest from the paddock, from F1's own site and independent motorsport press.",
          },
          {
            title: 'Live Timing',
            text: "Follow a session live, straight from F1's own timing feed.",
          },
          {
            title: 'Pit Wall',
            text: 'Only there if Kimi gave you access. Send ideas for the site, or just a message if something is wrong.',
          },
          {
            title: 'How to Play',
            text: 'A short walkthrough with examples and a points calculator you can play with.',
          },
          {
            title: 'FAQ',
            text: 'Quick answers to the questions players ask most.',
          },
        ],
      },
      {
        title: 'At the bottom of the menu',
        items: [
          {
            title: 'Rules',
            text: 'How points are scored, the deadlines, and what DNF and DNS mean for the first-retirement bonus.',
          },
          {
            title: 'About',
            text: 'What Poule Position is and how it works.',
          },
          {
            title: 'Privacy Policy',
            text: 'What data is stored about players and how it is used.',
          },
        ],
      },
      {
        title: 'Good to know',
        items: [
          {
            title: 'Deadline',
            text: 'Predictions lock 1 minute before a race starts. Until then you can change yours as often as you like.',
          },
          {
            title: 'Forgot to predict?',
            text: 'You get a reminder about an hour before the start. If you still miss it, your last prediction is copied in and you get an email with what was entered.',
          },
          {
            title: 'First retirement',
            text: 'A driver who does not start (DNS) is not a retirement, so that driver can never be the first one out. The Rules page explains DNF and DNS.',
          },
        ],
      },
    ],
    callout: {
      title: 'Something wrong, or something missing?',
      paragraphs: [
        'Found something that does not work, or something that could be better? Let me know.',
        'Press the button to send me an email, or just reply to this one.',
      ],
      button: 'Mail Kimi',
      mailSubject: 'Poule Position',
    },
    closing: 'Questions? Just reply to this email.',
  },
  nl: {
    subject: 'Wist je dat? Zo vind je je weg op je telefoon',
    banner: 'Wist je dat?',
    intro:
      'Poule Position werkt prima op je telefoon en alles zit één tik weg. Hier een korte rondleiding: wat je bovenaan het scherm vindt, wat er in het menu staat en waar elke pagina voor dient.',
    sections: [
      {
        title: 'Bovenaan elke pagina',
        items: [
          {
            title: 'Menu',
            text: "De vierkante knop met drie streepjes, linksboven, opent het menu met alle pagina's van de site. Tik op het kruisje, of ergens naast het menu, om het te sluiten.",
          },
          {
            title: 'Logo',
            text: 'Tik op het logo om vanaf elke pagina terug te gaan naar home.',
          },
          {
            title: 'EN | NL',
            text: 'Wissel de site tussen Engels en Nederlands.',
          },
          {
            title: 'Delen',
            text: 'Stuur je vrienden een link naar het spel.',
          },
          {
            title: 'Je foto of beginletter',
            text: 'Rechtsboven. Die opent je profiel, waar je je foto, bijnaam, e-mailadres, taal of wachtwoord aanpast.',
          },
        ],
      },
      {
        title: 'In het menu',
        items: [
          {
            title: 'Home',
            text: 'De eerstvolgende race met een aftelklok, en de plek waar je je voorspelling doet.',
          },
          {
            title: 'Raceoverzicht',
            text: 'De kalender van het seizoen. Tik op een race en je ziet alle sessies van dat weekend met de starttijden in Nederlandse tijd.',
          },
          {
            title: 'Coureurs',
            text: 'Het coureurskampioenschap: waar elke coureur staat.',
          },
          {
            title: 'Teams',
            text: 'De teams met hun coureurs en motoren.',
          },
          {
            title: 'Kampioenschap',
            text: 'Het klassement van de spelers. Schuif race voor race door het seizoen en zie het klassement veranderen.',
          },
          {
            title: 'Groepen',
            text: 'Speel tegen je eigen vrienden. Iedereen voorspelt zoals gewoonlijk en elke groep heeft een eigen klassement. Je doet mee via de link die de starter van de groep deelt, en alleen spelers die Kimi daarvoor heeft aangezet kunnen een groep beginnen.',
          },
          {
            title: 'Mijn voorspellingen',
            text: 'Al je voorspellingen, race voor race, met de punten die elke keuze opleverde. Bij races die nog niet zijn begonnen staat een knop om te bewerken.',
          },
          {
            title: 'Statistieken',
            text: 'Seizoenshoogtepunten en leuke weetjes over de spelers, plus de uitslagen van de kwalificatie, de sprint en de race.',
          },
          {
            title: 'Nieuws',
            text: 'Het laatste nieuws uit de paddock, van de site van F1 zelf en van onafhankelijke motorsportmedia.',
          },
          {
            title: 'Live tijden',
            text: 'Volg een sessie live, rechtstreeks uit de timingfeed van F1 zelf.',
          },
          {
            title: 'Pit Wall',
            text: 'Alleen zichtbaar als Kimi je toegang heeft gegeven. Stuur ideeën voor de site, of gewoon een bericht als er iets niet klopt.',
          },
          {
            title: 'Zo speel je',
            text: 'Een korte uitleg met voorbeelden en een puntenrekenmachine om mee te spelen.',
          },
          {
            title: 'FAQ',
            text: 'Snelle antwoorden op de vragen die spelers het vaakst stellen.',
          },
        ],
      },
      {
        title: 'Onderaan het menu',
        items: [
          {
            title: 'Regels',
            text: 'Hoe punten worden geteld, de deadlines, en wat DNF en DNS betekenen voor de bonus voor de eerste uitvaller.',
          },
          {
            title: 'Over',
            text: 'Wat Poule Position is en hoe het werkt.',
          },
          {
            title: 'Privacybeleid',
            text: 'Welke gegevens we van spelers bewaren en hoe we ze gebruiken.',
          },
        ],
      },
      {
        title: 'Goed om te weten',
        items: [
          {
            title: 'Deadline',
            text: 'Voorspellingen sluiten 1 minuut voor de start van een race. Tot dan pas je de jouwe zo vaak aan als je wilt.',
          },
          {
            title: 'Vergeten te voorspellen?',
            text: 'Ongeveer een uur voor de start krijg je een herinnering. Mis je het toch, dan nemen we je laatste voorspelling over en mailen we je wat er is ingevuld.',
          },
          {
            title: 'Eerste uitvaller',
            text: 'Een coureur die niet start (DNS) is geen uitvaller, en kan dus nooit de eerste uitvaller zijn. Op de Regels-pagina staat wat DNF en DNS betekenen.',
          },
        ],
      },
    ],
    callout: {
      title: 'Klopt er iets niet, of mis je iets?',
      paragraphs: [
        'Iets gevonden dat niet werkt, of iets dat beter kan? Laat het me weten.',
        'Druk op de knop om me een mail te sturen, of antwoord gewoon op deze mail.',
      ],
      button: 'Mail Kimi',
      mailSubject: 'Poule Position',
    },
    closing: 'Vragen? Antwoord gewoon op deze mail.',
  },
};
