/* Spielpläne Saison 2026/2027 (Hinrunde ab November + Rückrunde) – [Anstoß, Gegner, Heimspiel] */
export const SCHEDULE = {
  fornsbach: [
    ["2026-11-08T17:30+01:00", "allm3", 0],
    ["2026-11-15T14:30+01:00", "oberbr", 1],
    ["2026-11-22T13:00+01:00", "grosser", 0],
    ["2026-11-29T14:30+01:00", "kirchberg", 1],
    ["2026-12-04T19:30+01:00", "vfrk", 0],
    ["2027-02-28T14:30+01:00", "leuten", 0],
    ["2027-03-07T15:00+01:00", "erbB", 1],
    ["2027-03-14T12:45+01:00", "ruder2", 0],
    ["2027-03-21T15:00+01:00", "lippold", 1],
    ["2027-04-04T15:00+02:00", "aspach", 0],
    ["2027-04-11T15:00+02:00", "althuette", 1],
    ["2027-04-18T15:00+02:00", "winn", 0],
    ["2027-05-02T15:00+02:00", "tuerk", 0],
    ["2027-05-09T15:00+02:00", "allm3", 1],
    ["2027-05-23T15:00+02:00", "oberbr", 0],
    ["2027-05-30T15:00+02:00", "grosser", 1],
    ["2027-06-05T13:30+02:00", "kirchberg", 0]
  ],
  vfrk: [
    ["2026-11-08T14:30+01:00", "tuerk", 0],
    ["2026-11-15T12:15+01:00", "allm3", 1],
    ["2026-11-22T13:00+01:00", "oberbr", 1],
    ["2026-11-29T12:15+01:00", "grosser", 1],
    ["2026-12-04T19:30+01:00", "fornsbach", 1],
    ["2027-02-21T14:30+01:00", "kirchberg", 0],
    ["2027-03-07T15:00+01:00", "leuten", 0],
    ["2027-03-14T12:15+01:00", "erbB", 0],
    ["2027-03-21T12:45+01:00", "ruder2", 1],
    ["2027-04-04T15:00+02:00", "lippold", 0],
    ["2027-04-11T12:45+02:00", "aspach", 1],
    ["2027-04-18T15:00+02:00", "althuette", 0],
    ["2027-04-25T12:45+02:00", "winn", 1],
    ["2027-05-09T12:45+02:00", "tuerk", 1],
    ["2027-05-23T12:45+02:00", "allm3", 0],
    ["2027-05-30T15:00+02:00", "oberbr", 0],
    ["2027-06-05T13:30+02:00", "grosser", 0]
  ],
  vfr: [
    ["2026-11-08T12:45+01:00", "allm2", 0],
    ["2026-11-15T14:30+01:00", "unter2", 1],
    ["2026-11-22T13:00+01:00", "klein", 0],
    ["2026-11-29T14:30+01:00", "weiler", 1],
    ["2026-12-06T14:30+01:00", "spiegel", 0],
    ["2027-02-21T14:30+01:00", "sulzm", 1],
    ["2027-02-28T14:30+01:00", "alex", 0],
    ["2027-03-07T15:00+01:00", "erbA", 1],
    ["2027-03-14T15:00+01:00", "ruder", 0],
    ["2027-03-21T15:00+01:00", "oppen2", 1],
    ["2027-04-04T15:00+02:00", "tsc", 0],
    ["2027-04-11T15:00+02:00", "stein2", 1],
    ["2027-04-18T15:00+02:00", "sulzl", 0],
    ["2027-04-25T15:00+02:00", "sk_fichtenberg", 1],
    ["2027-05-09T15:00+02:00", "allm2", 1],
    ["2027-05-23T12:45+02:00", "unter2", 0],
    ["2027-05-30T16:00+02:00", "klein", 1],
    ["2027-06-05T16:00+02:00", "weiler", 0]
  ],
  sgm5: [
    ["2026-11-15T12:15+01:00", "oberbr2", 1],
    ["2026-11-22T15:15+01:00", "klein2", 0],
    ["2026-11-29T12:15+01:00", "kirchberg2", 1],
    ["2026-12-06T12:15+01:00", "spiegel2", 0],
    ["2027-02-21T12:15+01:00", "sulzm2", 1],
    ["2027-02-28T12:15+01:00", "alex2", 0],
    ["2027-03-14T12:45+01:00", "leuten2", 0],
    ["2027-03-21T12:45+01:00", "oppen3", 1],
    ["2027-04-18T12:45+02:00", "sulzl2", 0],
    ["2027-04-25T12:45+02:00", "fichten2", 1],
    ["2027-05-02T12:45+02:00", "tuerk2", 0],
    ["2027-05-23T12:45+02:00", "oberbr2", 0],
    ["2027-05-30T12:45+02:00", "klein2", 1],
    ["2027-06-05T14:00+02:00", "kirchberg2", 0]
  ]
};

/* Mannschaften mit Spielplan (Reihenfolge der Auswahl „Spielt für“) */
export const TEAMS = ['vfr', 'vfrk', 'fornsbach', 'sgm5'];

const H = 3600e3;
const fixture = (team, r) => ({ team, at: new Date(r[0]), o: r[1], home: !!r[2] });

/* Nächstes Spiel einer Mannschaft. Ein Spiel bleibt bis 4 Stunden nach Anpfiff „aktuell“. */
export function nextFixture(team, now = Date.now()) {
  const r = (SCHEDULE[team] || []).find(x => new Date(x[0]).getTime() + 4 * H > now);
  return r ? fixture(team, r) : null;
}
/* Letztes bereits angepfiffenes Spiel (für Nachträge) */
export function lastFixture(team, now = Date.now()) {
  const l = (SCHEDULE[team] || []).filter(x => new Date(x[0]).getTime() <= now);
  return l.length ? fixture(team, l[l.length - 1]) : null;
}
/* Alle noch anstehenden Spiele einer Mannschaft */
export function upcomingFixtures(team, now = Date.now()) {
  return (SCHEDULE[team] || []).filter(x => new Date(x[0]).getTime() + 4 * H > now).map(r => fixture(team, r));
}
