// Navigation metadata, not official SaTourN field semantics. First match wins.
export const FIELD_GROUPS = [
  { id: 'quality', label: 'Datenqualität / interne Felder', pattern: /^(DQ_|EVALUATION_|Erweitert_Datenqualitaet)/i, aliases: 'Qualität Prüfung intern' },
  { id: 'system', label: 'System- und Metadaten', pattern: /^(SYSTEMID_|C_|Quelle|Fragment$|Duplicate|PeopleCounter|Erweitert$)|^(Poi|Pois|Artikel|ArtikelList|Adresse|Adressen|Gastro|Gastros|Veranstaltung|Veranstaltungen|Vermieter|Betrieb|string)$/i, aliases: 'ID Import Herkunft System' },
  { id: 'accessibility', label: 'Barrierefreiheit', pattern: /^ACCESSIBILITY_|Barrierefrei/i, aliases: 'Rollstuhl wheelchair Zugang accessibility' },
  { id: 'opening', label: 'Öffnungszeiten', pattern: /^ALWAYSOPEN$|OEFFNUNG|ÖFFNUNG|OPENING|OBJECT_CLOSED_|^INFO_SEASON_/i, aliases: 'öffnung oeffnung opening geschlossen Saison Zeiten' },
  { id: 'prices', label: 'Preise', pattern: /^PRICE_|PRICEINFO|^Currency$/i, aliases: 'price Kosten Eintritt Bezahlung' },
  { id: 'contact', label: 'Kontakt', pattern: /^(OBJECT_CONTACT_|CONTACT_|ORG_|AUTOR_)/i, aliases: 'contact Email Telefon Adresse Anschrift' },
  { id: 'geo', label: 'Geodaten', pattern: /^(Latitude|Longitude|OrtID|Oepnv)$|^OBJECT_(ANREISE|BUSSTOP|PARKING)|^GEO_/i, aliases: 'Koordinaten Lage Anreise latitude longitude' },
  { id: 'media', label: 'Medien / Social / SEO', pattern: /^(SOCIAL_|WEB_|Social|IFRAME_|Copyright)|IMAGE|VIDEO|PHOTO|BILD|LOGO|CREATIVECOMMONS/i, aliases: 'Bilder Fotos Medien social seo web' },
  { id: 'audience', label: 'Zielgruppen / Eignung', pattern: /^(TARGET_|LANGUAGE_|OBJECT_FIT_|Familie|Familientipps)/i, aliases: 'Eignung Zielgruppe Sprachen Familie Gruppen' },
  { id: 'classification', label: 'Kategorien und Klassifikation', pattern: /^(Kategorie|Betriebsart|Keywords|GeneratedBooleanKeywords|Tags)$|KLASSIFIZIERUNG/i, aliases: 'category Kategorie Merkmale feature Stichworte' },
  { id: 'base', label: 'Basisdaten', pattern: /^(Bezeichnung|Name|Titel|PID|ID|Betriebsnummer|OBJECT_TEXT_NAME(?:_SORTIERUNG|_URL)?)$/i, aliases: 'Name Titel Bezeichnung Identifikation' },
  { id: 'texts', label: 'Texte', pattern: /TEXT|BESCHREIBUNG|TEASER|DESCRIPTION|ZUSATZINFO/i, aliases: 'Beschreibung Text Inhalt' },
  { id: 'other', label: 'Sonstige', pattern: /.*/, aliases: '' },
];

export function groupFor(field) {
  return FIELD_GROUPS.find(group => group.pattern.test(field.field));
}

// Presentation order is independent of the classifier's first-match priority.
export const DISPLAY_GROUPS = ['base', 'texts', 'classification', 'contact', 'opening', 'prices', 'geo', 'accessibility', 'audience', 'media', 'other', 'quality', 'system'].map(id => FIELD_GROUPS.find(group => group.id === id));
