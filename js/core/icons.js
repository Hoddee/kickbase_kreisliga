/* SVG-Symbole als Strings (werden in Templates eingesetzt) */
import { PL, STATUS_NAME } from '../data/players.js';

export const ICON = {
  halftime: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M7.5 12h9"/></svg>',
  subOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v14M6 12l6 6 6-6"/></svg>',
  subIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6M6 12l6-6 6 6"/></svg>',
  whistle: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 17.5a7 7 0 0 0 13.6 2.3L28 15.5V10H12.5A7 7 0 0 0 4 17.5z"/><circle cx="11" cy="17.5" r="2"/><path d="M20 10V6.5"/></svg>',
  ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.2l3.9 2.8-1.5 4.6H9.6L8.1 10z" fill="currentColor"/><path d="M12 7.2V3M15.9 10l4-1.4M14.4 14.6l2.4 3.4M9.6 14.6L7.2 18M8.1 10L4.1 8.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  boot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2.5 15.2c0-1.1.7-2 1.8-2.3l5.1-1.3 1.4-4 2.4 1-.9 2.3 6 2.7c1.1.5 1.7 1.3 1.7 2.4v.8c0 .6-.5 1.1-1.1 1.1H3.6c-.6 0-1.1-.5-1.1-1.1z"/><path fill="currentColor" d="M5 19h2.2v2H5zM9.6 19h2.2v2H9.6zM14.2 19h2.2v2h-2.2z"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  injured: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="20" height="20" rx="5" fill="#E5262D"/><path d="M8 4.5h4v3.5h3.5v4H12v3.5H8V12H4.5V8H8z" fill="#fff"/></svg>',
  knock: '<svg viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(-45 10 10)"><rect x="1" y="6" width="18" height="8" rx="4" fill="#F2A33A"/><rect x="7" y="6" width="6" height="8" fill="#F7C987"/><circle cx="8.8" cy="8.6" r=".7" fill="#B9701C"/><circle cx="11.2" cy="8.6" r=".7" fill="#B9701C"/><circle cx="8.8" cy="11.4" r=".7" fill="#B9701C"/><circle cx="11.2" cy="11.4" r=".7" fill="#B9701C"/></g></svg>',
  brand: '<svg viewBox="0 0 30 30" aria-hidden="true"><rect width="30" height="30" rx="8" fill="#ff4600"/><circle cx="15" cy="15" r="7.2" fill="none" stroke="#fff" stroke-width="2.2"/><path d="M15 3v24M3 15h4.8M22.2 15H27" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>'
};

/* Verletzungs-Symbol wie bei Kickbase: rotes Kreuz = verletzt, Pflaster = angeschlagen */
export function statusIcon(playerId) {
  const st = PL[playerId] && PL[playerId].status;
  if (st !== 'inj' && st !== 'hit') return '';
  const label = STATUS_NAME[st] + (PL[playerId].info ? ': ' + PL[playerId].info : '');
  return '<span class="sti" title="' + label.replace(/"/g, '&quot;') + '" aria-label="' + label.replace(/"/g, '&quot;') + '">' + (st === 'inj' ? ICON.injured : ICON.knock) + '</span>';
}
