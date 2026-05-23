import type { PointType } from '@/types/point';

export type PointHelpBlock = {
  title: string;
  lines: string[];
};

export function pointHelpForType(type: PointType): PointHelpBlock {
  switch (type) {
    case 'biblioteca':
    case 'libreria':
      return {
        title: type === 'biblioteca' ? 'Come funziona in biblioteca' : 'Come funziona in libreria',
        lines: [
          'L\'elenco sotto è quello ufficiale del punto.',
          'Da casa: Prenota — il libro resta riservato per te (nessun QR).',
          'In sede: menu ⋮ → Ricevi (copia disponibile) o Ritiralo se l\'hai già prenotato — QR da mostrare all\'addetto.',
          'L\'addetto scansiona il QR e conferma: il libro passa a te.',
          'Per donare un volume: fotocamera → inquadra l\'ISBN → Dona → QR per l\'addetto.',
        ],
      };
    case 'corner_free':
      return {
        title: 'Come funziona in Corner Free',
        lines: [
          'Dalla lista: Ricevi sul libro che vuoi prendere.',
          'Serve essere vicino al corner (GPS): poi inquadri il codice a barre sul volume e confermi.',
          'Libro in lista ma assente? Segnala «Non c\'è più» dal menu ⋮.',
          'Libro non in elenco? Puoi prenderlo lo stesso: se lo riporterai in un punto Libery entrerà nel circuito.',
          'Per donare: fotocamera → ISBN → Dona (nel corner la conferma è in app).',
        ],
      };
    default:
      return { title: 'Punto Libery', lines: [] };
  }
}

export const CAMERA_GUIDE_LINES = {
  intro:
    'Inquadra il codice a barre sul dorso del libro. Tocca lo schermo per mettere a fuoco; usa la torcia se serve.',
  findBook: 'Sto cercando il libro nel catalogo Libery…',
  leaveCertified:
    'Premi Dona: compare un QR. Mostralo all\'addetto del punto: quando preme Ricevuto sul suo telefono, la consegna è registrata.',
  leaveCorner: 'Premi Dona per confermare il deposito nel corner: il libro sarà disponibile per il prossimo lettore.',
  takeCertified:
    'In biblioteca o libreria non si prende dalla fotocamera: usa la lista del punto (Prenota / Ritiralo con QR).',
  takeCorner:
    'Nel corner usa la lista del punto: Ricevi, poi inquadra l\'ISBN quando sei sul posto.',
  unknownIsbn:
    'ISBN non nel catalogo. Puoi portarlo in un Corner Free o consegnarlo in biblioteca/libreria: alla prima consegna entrerà in Libery.',
  scanPreview:
    'Libro riconosciuto. Apri la scheda per i dettagli o premi Dona per generare il QR da mostrare all\'addetto.',
} as const;
