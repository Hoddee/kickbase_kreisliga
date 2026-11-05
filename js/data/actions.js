/* Aktionen laut Kickbase-Punktetabelle.
   Wert: Zahl oder Objekt je Position {TW, ABW, MIT, ANG, SUB}; SUB gilt, wenn der Spieler eingewechselt wurde.
   "only" begrenzt eine Gruppe auf eine Position (Torwart-Aktionen). */
export const GROUPS = {
  att: [
    { t: 'Tore & Vorlagen', a: [
      ['goal', 'Tor', { TW: 120, ABW: 100, MIT: 90, ANG: 80, SUB: 80 }],
      ['pen', 'Elfmeter verwandelt', 80],
      ['long', 'Tor von außerhalb des 16ers (Bonus)', 10],
      ['ast', 'Vorlage', { TW: 55, ABW: 45, MIT: 35, ANG: 35, SUB: 35 }],
      ['setup', 'Torvorbereitung', { TW: 45, ABW: 35, MIT: 25, ANG: 25, SUB: 25 }],
      ['defl', 'Abgefälschte Vorlage', 25],
      ['reb', 'Abpraller-Vorlage', 15],
      ['wood', 'Pfosten-/Latten-Vorlage', 15],
      ['intent', 'Absichtliche Vorlage (Bonus)', 10],
      ['pwon', 'Elfmeter herausgeholt', 30],
      ['ogf', 'Eigentor erzwungen', 25]
    ]},
    { t: 'Chancen & Schüsse', a: [
      ['bcc', 'Großchance kreiert', 15],
      ['deadly', 'Pass des Todes', 15],
      ['sast', 'Schussvorlage', 5],
      ['sot', 'Schuss aufs Tor', 12],
      ['sjp', 'Schuss knapp vorbei', 10],
      ['sfar', 'Schuss weit vorbei', 5],
      ['sblk', 'Schuss geblockt (wäre aufs Tor)', 8],
      ['post', 'Pfosten', 10],
      ['bar', 'Latte', 10]
    ]},
    { t: 'Aufbau & Standards', a: [
      ['cross', 'Flanke angekommen', 3],
      ['corner', 'Ecke herausgeholt', 1],
      ['fouled3', 'Foul gezogen im letzten Drittel', 1],
      ['lball', 'Präziser langer Pass', 1],
      ['pf3', 'Pass ins letzte Drittel', 1],
      ['poh', 'Pass in die gegnerische Hälfte', 1]
    ]}
  ],
  def: [
    { t: 'Torwart', only: 'TW', a: [
      ['pgt', 'Elfmeter gehalten', 100],
      ['sv', 'Parade', 15],
      ['bcs', 'Großchance vereitelt', 15],
      ['bw15', 'Ball weggeschnappt (bedrängt)', 15],
      ['catch', 'Ball gefangen', 10],
      ['rush', 'Erfolgreich rausgelaufen', 10],
      ['shh', 'Schuss gehalten', 10],
      ['bw5', 'Ball weggeschnappt', 5],
      ['stand', 'Ball im Stand abgewehrt', 5],
      ['punch', 'Faustabwehr', 5],
      ['lsh', 'Fernschuss gehalten', 5],
      ['xcl', 'Flanke abgefangen', 5],
      ['thr', 'Erfolgreicher Abwurf', 1]
    ]},
    { t: 'Ballgewinn & Zweikampf', a: [
      ['duel', 'Zweikampf gewonnen', 5],
      ['contest', 'Gegner ausgespielt', 5],
      ['icpt', 'Ball erobert', 5],
      ['aerw', 'Kopfballduell gewonnen', 3],
      ['pinti', 'Pass abgefangen im eigenen 16er', 3],
      ['pinto', 'Pass abgefangen außerhalb des 16ers', 1]
    ]},
    { t: 'Klären & Blocken', a: [
      ['tackle', 'Zweikampf als letzter Mann', 15],
      ['line', 'Auf der Linie geklärt', 15],
      ['blk6', 'Schuss geblockt im 5er', 15],
      ['blk16', 'Schuss geblockt im 16er', 10],
      ['blko', 'Schuss geblockt außerhalb des 16ers', 5],
      ['clri', 'Geklärt im eigenen 16er', 5],
      ['clro', 'Geklärt außerhalb des 16ers', 3],
      ['xblk', 'Flanke geblockt', 2],
      ['xblkp', 'Flanke geblockt, Ball behalten', 1]
    ]}
  ],
  err: [
    { t: 'Torwart-Fehler', only: 'TW', a: [
      ['xmiss', 'Flanke verpasst', -5],
      ['bpf', 'Rückpass-Foul', -5],
      ['six', '6-Sekunden-Regel', -5]
    ]},
    { t: 'Karten & Strafstöße', a: [
      ['yel', 'Gelbe Karte', -10],
      ['yel2', 'Gelb-Rot', -50],
      ['pcon', 'Elfmeter verursacht', -45],
      ['pmiss', 'Elfmeter verschossen', -60],
      ['own', 'Eigentor', -60]
    ]},
    { t: 'Schwere Fehler', a: [
      ['mgoal', 'Fehler vor Gegentor', -45],
      ['mshot', 'Fehler vor Gegner-Schuss', -15],
      ['bcm', 'Großchance vergeben', -15],
      ['danger', 'Gefährliches Spiel', -5],
      ['throw', 'Falscher Einwurf', -5]
    ]},
    { t: 'Kleinkram', a: [
      ['lost', 'Zweikampf verloren', -3],
      ['off', 'Abseits', -3],
      ['foul', 'Foul', -2],
      ['hand', 'Handspiel', -2],
      ['aerl', 'Kopfballduell verloren', -1],
      ['poss', 'Ballverlust', -1],
      ['far', 'Ball zu weit vorgelegt', -1]
    ]}
  ]
};

/* "Zu null" pro 10 Minuten je Position (Kickbase), dazu derselbe Wert bei voller Spielzeit */
export const CLEAN_SHEET = { TW: 5, ABW: 3, MIT: 2, ANG: 1 };

/* Aktionen, die als Tor bzw. Vorlage im Balkendiagramm gezählt werden */
export const GOAL_KEYS = { goal: 1, pen: 1 };
export const ASSIST_KEYS = { ast: 1, defl: 1, reb: 1, wood: 1 };

/* Vorschläge für die Schnellleiste, bevor etwas gebucht wurde */
export const QUICK_DEFAULTS = {
  TW: ['sv', 'catch', 'xcl', 'bw5', 'thr', 'poss', 'lball', 'stand'],
  ANG: ['sot', 'duel', 'lost', 'poss', 'bcc', 'sjp', 'sfar', 'fouled3'],
  ABW: ['duel', 'icpt', 'lost', 'poss', 'pf3', 'clri', 'lball', 'poh'],
  MIT: ['duel', 'icpt', 'lost', 'poss', 'pf3', 'lball', 'poh', 'sot']
};
