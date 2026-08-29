// ============================================================
// CARD-ART.JS — Original vector illustrations (no emoji, no
// external images). Every shape here is hand-drawn geometry so
// there's nothing to license or attribute.
// ============================================================

const CP_ICONS = {
  police: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 4 L54 13 V29 C54 43 44 53 32 60 C20 53 10 43 10 29 V13 Z" fill="#25406b" stroke="#e8b74d" stroke-width="2.5"/>
    <path d="M32 15 L37.4 25.6 L49 27.1 L40.6 35.2 L42.6 46.7 L32 41 L21.4 46.7 L23.4 35.2 L15 27.1 L26.6 25.6 Z" fill="#e8b74d"/>
  </svg>`,

  thief: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 8 L37 17 L27 17 Z" fill="#4a1c1a"/>
    <ellipse cx="32" cy="35" rx="23" ry="20" fill="#241010"/>
    <path d="M9 31 Q32 15 55 31 L55 35 Q32 21 9 35 Z" fill="#150a0a"/>
    <ellipse cx="22" cy="35" rx="6.5" ry="4.5" fill="#f2ede2"/>
    <ellipse cx="42" cy="35" rx="6.5" ry="4.5" fill="#f2ede2"/>
    <ellipse cx="22" cy="35" rx="2.6" ry="2.6" fill="#241010"/>
    <ellipse cx="42" cy="35" rx="2.6" ry="2.6" fill="#241010"/>
  </svg>`,

  king: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 46 L13 21 L25 33 L32 14 L39 33 L51 21 L55 46 Z" fill="#e8b74d" stroke="#7a4f12" stroke-width="2"/>
    <rect x="9" y="46" width="46" height="8" rx="2" fill="#e8b74d" stroke="#7a4f12" stroke-width="2"/>
    <circle cx="13" cy="21" r="4.2" fill="#f2cf7e" stroke="#7a4f12" stroke-width="1.5"/>
    <circle cx="32" cy="14" r="4.6" fill="#f2cf7e" stroke="#7a4f12" stroke-width="1.5"/>
    <circle cx="51" cy="21" r="4.2" fill="#f2cf7e" stroke="#7a4f12" stroke-width="1.5"/>
    <circle cx="32" cy="47" r="4" fill="#6a2a26"/>
  </svg>`,

  minister: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="40" width="38" height="6" rx="2" fill="#2d3a5e"/>
    <rect x="19" y="14" width="26" height="27" rx="3" fill="#333f66"/>
    <rect x="19" y="10" width="26" height="6" rx="2" fill="#232c49"/>
    <path d="M21 48 Q32 55 43 48" stroke="#f2ede2" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  </svg>`,

  warrior: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 13 L45 45" stroke="#c7cbe0" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M51 13 L19 45" stroke="#c7cbe0" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M11 11 L18 11 L18 18" stroke="#7a4f12" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M53 11 L46 11 L46 18" stroke="#7a4f12" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="5.5" fill="#e8b74d" stroke="#7a4f12" stroke-width="1.5"/>
  </svg>`,

  merchant: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M25 19 Q32 9 39 19 L47 30 Q52 45 32 51 Q12 45 17 30 Z" fill="#c99a3a" stroke="#7a4f12" stroke-width="1.5"/>
    <path d="M27 17 L37 17" stroke="#7a4f12" stroke-width="3" stroke-linecap="round"/>
    <path d="M32 27 V41 M28 30.5 Q32 28.5 36 30.5 M28 37.5 Q32 39.5 36 37.5" stroke="#4a2f0a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  </svg>`,

  joker: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 42 Q9 15 22 24 Q26 6 32 24 Q38 6 42 24 Q55 15 55 42 Z" fill="#7a3a8a" stroke="#4a2258" stroke-width="1.5"/>
    <rect x="9" y="42" width="46" height="7" rx="2" fill="#5a2a66"/>
    <circle cx="22" cy="22" r="4.2" fill="#e8b74d"/>
    <circle cx="32" cy="20" r="4.2" fill="#e8b74d"/>
    <circle cx="42" cy="22" r="4.2" fill="#e8b74d"/>
  </svg>`,

  shield: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 6 L52 14 V29 C52 43 42 53 32 58 C22 53 12 43 12 29 V14 Z" fill="#3a4f7e" stroke="#8fa5d6" stroke-width="2.5"/>
  </svg>`,

  star: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 7 L39.5 25.5 L59 26.5 L44 39 L48.5 58 L32 47.5 L15.5 58 L20 39 L5 26.5 L24.5 25.5 Z" fill="#e8b74d" stroke="#7a4f12" stroke-width="1.5"/>
  </svg>`,

  gem: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 24 L32 8 L48 24 L32 58 Z" fill="#4a90d9" stroke="#bcd8f7" stroke-width="2"/>
    <path d="M16 24 H48 M24 24 L32 58 M40 24 L32 58" stroke="#bcd8f7" stroke-width="1.2"/>
  </svg>`,

  scroll: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="13" y="15" width="38" height="34" rx="4" fill="#d9c9a0"/>
    <rect x="13" y="15" width="38" height="7" rx="3" fill="#c2ac7a"/>
    <rect x="13" y="42" width="38" height="7" rx="3" fill="#c2ac7a"/>
    <line x1="20" y1="28" x2="44" y2="28" stroke="#7a6a4a" stroke-width="2.2"/>
    <line x1="20" y1="35" x2="44" y2="35" stroke="#7a6a4a" stroke-width="2.2"/>
  </svg>`,

  moon: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M40 8 A24 24 0 1 0 40 56 A19 19 0 1 1 40 8 Z" fill="#c7cbe0"/>
  </svg>`,

  // Avatars
  user: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="23" r="12" fill="currentColor"/>
    <path d="M11 55 C11 40 20 33 32 33 C44 33 53 40 53 55 Z" fill="currentColor"/>
  </svg>`,

  bot: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <rect x="16" y="22" width="32" height="26" rx="9" fill="currentColor"/>
    <rect x="28" y="10" width="8" height="11" rx="3" fill="currentColor"/>
    <circle cx="32" cy="8" r="3.2" fill="currentColor"/>
    <circle cx="26" cy="35" r="4.2" fill="#0f1520"/>
    <circle cx="38" cy="35" r="4.2" fill="#0f1520"/>
  </svg>`,

  crown_small: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 46 L13 21 L25 33 L32 14 L39 33 L51 21 L55 46 Z" fill="currentColor"/>
    <rect x="9" y="46" width="46" height="8" rx="2" fill="currentColor"/>
  </svg>`,

  trophy: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 10 H44 V26 C44 35 38 41 32 41 C26 41 20 35 20 26 Z" fill="#e8b74d" stroke="#7a4f12" stroke-width="2"/>
    <path d="M20 14 C12 14 10 22 16 27 C18.5 29 20.5 29 20.5 29" stroke="#e8b74d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M44 14 C52 14 54 22 48 27 C45.5 29 43.5 29 43.5 29" stroke="#e8b74d" stroke-width="3" fill="none" stroke-linecap="round"/>
    <rect x="28" y="41" width="8" height="9" fill="#e8b74d"/>
    <rect x="19" y="50" width="26" height="6" rx="2" fill="#e8b74d" stroke="#7a4f12" stroke-width="2"/>
  </svg>`,
};

const CP_CUSTOM_ICON_KEYS = ['king', 'minister', 'warrior', 'merchant', 'joker', 'shield', 'star', 'gem', 'scroll', 'moon'];

function cardIconSvg(key) {
  return CP_ICONS[key] || CP_ICONS.star;
}

if (typeof window !== 'undefined') {
  window.CP_CardArt = { cardIconSvg, CUSTOM_ICON_KEYS: CP_CUSTOM_ICON_KEYS };
}
