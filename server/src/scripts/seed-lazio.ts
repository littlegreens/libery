/**
 * Seed Lazio:
 *  - Sospende i punti fuori dal Lazio (città non laziali)
 *  - 30 biblioteche reali dal CSV della Provincia di Roma
 *  - 20 librerie di Roma e provincia
 *  - 20 corner sparsi nel Lazio
 *  - 300 libri reali da Google Books (lang=it)
 *  - Distribuzione bilanciata su tutti i punti Lazio
 *
 * Lancia con:  npm run seed:lazio
 */

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { normalizeIsbn } from '../lib/isbn.js';
import { resolveBookByIsbn } from '../services/bookCatalog.js';

// ---------- COMUNI DEL LAZIO (per filtrare i punti da sospendere) ----------

const LAZIO_CITIES = new Set([
  'Roma', 'Fiumicino', 'Pomezia', 'Ciampino', 'Frascati', 'Velletri',
  'Anzio', 'Nettuno', 'Marino', 'Albano Laziale', 'Genzano di Roma',
  'Ariccia', 'Castel Gandolfo', 'Rocca di Papa', 'Grottaferrata',
  'Montecompatri', 'Monte Porzio Catone', 'Colonna', 'San Cesareo',
  'Cave', 'Palestrina', 'Zagarolo', 'Genazzano', 'Gallicano nel Lazio',
  'Valmontone', 'Colleferro', 'Artena', 'Segni', 'Carpineto Romano',
  'Tivoli', 'Guidonia Montecelio', 'Mentana', 'Monterotondo', 'Fiano Romano',
  'Capena', 'Bracciano', 'Trevignano Romano', 'Anguillara Sabazia',
  'Cerveteri', 'Ladispoli', 'Civitavecchia', 'Santa Marinella', 'Tolfa',
  'Allumiere', 'Manziana', 'Formello', 'Campagnano', 'Campagnano di Roma',
  'Mazzano Romano', 'Anticoli Corrado', 'Arsoli', 'Subiaco', 'Roviano',
  'Vicovaro', 'Mandela', 'Rocca Priora', 'Roccagiovine', 'Castel Madama',
  'Lanuvio', 'Lariano', 'Lariano', 'Rocca di Papa', 'Velletri',
  'Frosinone', 'Cassino', 'Ferentino', 'Anagni', 'Alatri', 'Sora',
  'Latina', 'Aprilia', 'Formia', 'Gaeta', 'Terracina', 'Fondi',
  'Viterbo', 'Civita Castellana', 'Tarquinia', 'Montefiascone',
  'Rieti', 'Poggio Mirteto', 'Cittaducale', 'Orte', 'Torrita Tiberina',
]);

// ---------- ORARI STANDARD ----------

const openingStandard = {
  lunedi: '09:00-19:00',
  martedi: '09:00-19:00',
  mercoledi: '09:00-19:00',
  giovedi: '09:00-19:00',
  venerdi: '09:00-20:00',
  sabato: '10:00-18:00',
  domenica: 'chiuso',
};

const openingCorner = {
  lunedi: '00:00-24:00',
  martedi: '00:00-24:00',
  mercoledi: '00:00-24:00',
  giovedi: '00:00-24:00',
  venerdi: '00:00-24:00',
  sabato: '00:00-24:00',
  domenica: '00:00-24:00',
};

// ---------- 30 BIBLIOTECHE DAL CSV ----------

type SeedPoint = {
  qrToken: string;
  name: string;
  type: 'biblioteca' | 'libreria' | 'corner_free';
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
};

const BIBLIOTECHE: SeedPoint[] = [
  {
    qrToken: 'lazio-bib-albano',
    name: 'Biblioteca Comunale Albano Laziale',
    type: 'biblioteca',
    city: 'Albano Laziale',
    address: 'Viale Risorgimento 5',
    latitude: 41.7313,
    longitude: 12.6600,
    description: 'Biblioteca civica del comune di Albano. Scaffale Libery all\'ingresso.',
  },
  {
    qrToken: 'lazio-bib-anguillara',
    name: 'Biblioteca Angela Zucconi Anguillara Sabazia',
    type: 'biblioteca',
    city: 'Anguillara Sabazia',
    address: 'Largo dello Zodiaco 21',
    latitude: 42.0853,
    longitude: 12.2730,
    description: 'Biblioteca comunale sul lago di Bracciano. Punto Libery in sala lettura.',
  },
  {
    qrToken: 'lazio-bib-anzio-cappell',
    name: 'Biblioteca Multimediale Chris Cappell Anzio',
    type: 'biblioteca',
    city: 'Anzio',
    address: 'Viale Antium 7/A',
    latitude: 41.4494,
    longitude: 12.6271,
    description: 'Biblioteca multimediale sul lungomare di Anzio. Scaffale bookcrossing al piano terra.',
  },
  {
    qrToken: 'lazio-bib-bracciano',
    name: 'Biblioteca Comunale Bracciano',
    type: 'biblioteca',
    city: 'Bracciano',
    address: 'Piazza dei Pasqualetti',
    latitude: 42.1046,
    longitude: 12.1760,
    description: 'Biblioteca nel centro storico di Bracciano. Circuito Libery attivo.',
  },
  {
    qrToken: 'lazio-bib-cerveteri',
    name: 'Biblioteca Comunale Cerveteri',
    type: 'biblioteca',
    city: 'Cerveteri',
    address: 'Via Etruria 39',
    latitude: 42.0003,
    longitude: 12.1027,
    description: 'Biblioteca civica di Cerveteri. Punto Libery nel corridoio centrale.',
  },
  {
    qrToken: 'lazio-bib-ciampino-pasolini',
    name: 'Biblioteca Pier Paolo Pasolini Ciampino',
    type: 'biblioteca',
    city: 'Ciampino',
    address: 'Via 4 Novembre 90',
    latitude: 41.8006,
    longitude: 12.6027,
    description: 'Biblioteca comunale dedicata a Pasolini. Scaffale Libery all\'ingresso.',
  },
  {
    qrToken: 'lazio-bib-civitavecchia-cialdi',
    name: 'Biblioteca A. Cialdi Civitavecchia',
    type: 'biblioteca',
    city: 'Civitavecchia',
    address: 'Piazza Calamatta 18',
    latitude: 42.0936,
    longitude: 11.7963,
    description: 'Principale biblioteca del porto di Civitavecchia. Angolo bookcrossing.',
  },
  {
    qrToken: 'lazio-bib-colleferro',
    name: 'Biblioteca Comunale Colleferro',
    type: 'biblioteca',
    city: 'Colleferro',
    address: 'Via Carpinetana Sud 144',
    latitude: 41.7289,
    longitude: 13.0074,
    description: 'Biblioteca civica di Colleferro con ampio scaffale Libery.',
  },
  {
    qrToken: 'lazio-bib-fiano-romano',
    name: 'Biblioteca Comunale Fiano Romano',
    type: 'biblioteca',
    city: 'Fiano Romano',
    address: 'Castello Orsini, Piazza Matteotti 21',
    latitude: 42.1622,
    longitude: 12.5937,
    description: 'Biblioteca nel castello medievale di Fiano Romano. Libery nell\'ala moderna.',
  },
  {
    qrToken: 'lazio-bib-fiumicino',
    name: 'Biblioteca Comunale Fiumicino',
    type: 'biblioteca',
    city: 'Fiumicino',
    address: 'Villa Guglielmi, Piazzale del Faro',
    latitude: 41.7736,
    longitude: 12.2346,
    description: 'Biblioteca nella villa storica affacciata sul Tevere. Punto Libery in sala.',
  },
  {
    qrToken: 'lazio-bib-frascati-basc',
    name: 'Biblioteca Archivio Storico Frascati',
    type: 'biblioteca',
    city: 'Frascati',
    address: 'Via Matteotti 32',
    latitude: 41.8111,
    longitude: 12.6772,
    description: 'BASC — Biblioteca e Archivio Storico di Frascati. Scaffale Libery al secondo piano.',
  },
  {
    qrToken: 'lazio-bib-genzano-levi',
    name: 'Biblioteca Carlo Levi Genzano di Roma',
    type: 'biblioteca',
    city: 'Genzano di Roma',
    address: 'Viale Mazzini 12',
    latitude: 41.7052,
    longitude: 12.6940,
    description: 'Biblioteca intitolata a Carlo Levi. Punto Libery con vista sui Castelli.',
  },
  {
    qrToken: 'lazio-bib-grottaferrata-martellotta',
    name: 'Biblioteca Bruno Martellotta Grottaferrata',
    type: 'biblioteca',
    city: 'Grottaferrata',
    address: 'Viale Giovanni Dusmet 20',
    latitude: 41.7893,
    longitude: 12.6720,
    description: 'Biblioteca moderna dei Castelli Romani. Scaffale Libery all\'ingresso.',
  },
  {
    qrToken: 'lazio-bib-guidonia',
    name: 'Biblioteca Comunale Guidonia',
    type: 'biblioteca',
    city: 'Guidonia Montecelio',
    address: 'Via M. Moris 7',
    latitude: 42.0093,
    longitude: 12.7147,
    description: 'Biblioteca civica di Guidonia. Punto Libery nella sala periodici.',
  },
  {
    qrToken: 'lazio-bib-ladispoli',
    name: 'Biblioteca Comunale Ladispoli',
    type: 'biblioteca',
    city: 'Ladispoli',
    address: 'Via Caltagirone',
    latitude: 41.9537,
    longitude: 12.0734,
    description: 'Biblioteca sul litorale laziale. Scaffale bookcrossing al piano terra.',
  },
  {
    qrToken: 'lazio-bib-marino-colonna',
    name: 'Biblioteca Vittoria Colonna Marino',
    type: 'biblioteca',
    city: 'Marino',
    address: 'Corso Vittoria Colonna, Parco di Villa Desideri',
    latitude: 41.7757,
    longitude: 12.6507,
    description: 'Biblioteca nel parco di Villa Desideri a Marino. Punto Libery in giardino.',
  },
  {
    qrToken: 'lazio-bib-mentana',
    name: 'Biblioteca Comunale Mentana',
    type: 'biblioteca',
    city: 'Mentana',
    address: 'Via Crescenzio 11',
    latitude: 42.0361,
    longitude: 12.6375,
    description: 'Biblioteca del comune di Mentana. Scaffale Libery in sala lettura.',
  },
  {
    qrToken: 'lazio-bib-monterotondo-angelani',
    name: 'Biblioteca Paolo Angelani Monterotondo',
    type: 'biblioteca',
    city: 'Monterotondo',
    address: 'Piazza Don Minzoni',
    latitude: 42.0537,
    longitude: 12.6218,
    description: 'Biblioteca civica di Monterotondo. Circuito Libery attivo dal 2024.',
  },
  {
    qrToken: 'lazio-bib-palestrina-fantoniana',
    name: 'Biblioteca Fantoniana Palestrina',
    type: 'biblioteca',
    city: 'Palestrina',
    address: 'Piazza del Carmine 1',
    latitude: 41.8380,
    longitude: 12.8958,
    description: 'Storica biblioteca prenestina. Scaffale Libery nella sala storica.',
  },
  {
    qrToken: 'lazio-bib-pomezia',
    name: 'Biblioteca Comunale Pomezia',
    type: 'biblioteca',
    city: 'Pomezia',
    address: 'Largo Catone',
    latitude: 41.6743,
    longitude: 12.5005,
    description: 'Biblioteca civica di Pomezia. Punto Libery nel corridoio d\'accesso.',
  },
  {
    qrToken: 'lazio-bib-santa-marinella',
    name: 'Biblioteca Comunale Santa Marinella',
    type: 'biblioteca',
    city: 'Santa Marinella',
    address: 'Via Aurelia 310/b',
    latitude: 42.0339,
    longitude: 11.8526,
    description: 'Biblioteca del comune costiero di Santa Marinella. Angolo Libery sul mare.',
  },
  {
    qrToken: 'lazio-bib-subiaco',
    name: 'Biblioteca Comunale Subiaco',
    type: 'biblioteca',
    city: 'Subiaco',
    address: 'Via della Repubblica 26',
    latitude: 41.9238,
    longitude: 13.0981,
    description: 'Biblioteca storica di Subiaco, città del primo libro stampato in Italia.',
  },
  {
    qrToken: 'lazio-bib-tivoli-coccanari',
    name: 'Biblioteca Maria Coccanari Fornari Tivoli',
    type: 'biblioteca',
    city: 'Tivoli',
    address: 'Piazza del Tempio d\'Ercole 1',
    latitude: 41.9597,
    longitude: 12.7988,
    description: 'Biblioteca con vista sul Tempio d\'Ercole. Scaffale Libery al secondo piano.',
  },
  {
    qrToken: 'lazio-bib-valmontone',
    name: 'Biblioteca Comunale Valmontone',
    type: 'biblioteca',
    city: 'Valmontone',
    address: 'Via del Broglio 1',
    latitude: 41.7853,
    longitude: 12.9118,
    description: 'Biblioteca civica di Valmontone. Punto Libery nell\'atrio.',
  },
  {
    qrToken: 'lazio-bib-velletri-tersenghi',
    name: 'Biblioteca Augusto Tersenghi Velletri',
    type: 'biblioteca',
    city: 'Velletri',
    address: 'Piazza Cairoli 54',
    latitude: 41.6859,
    longitude: 12.7800,
    description: 'Principale biblioteca dei Colli Albani meridionali. Scaffale Libery in sala.',
  },
  {
    qrToken: 'lazio-bib-zagarolo-coletti',
    name: 'Biblioteca Giovanni Coletti Zagarolo',
    type: 'biblioteca',
    city: 'Zagarolo',
    address: 'Palazzo Rospigliosi, Piazza Indipendenza',
    latitude: 41.8397,
    longitude: 12.8401,
    description: 'Biblioteca nel palazzo storico Rospigliosi. Angolo Libery nel chiostro.',
  },
  {
    qrToken: 'lazio-bib-cave',
    name: 'Biblioteca Comunale Cave',
    type: 'biblioteca',
    city: 'Cave',
    address: 'Piazza Garibaldi 4',
    latitude: 41.8023,
    longitude: 12.9399,
    description: 'Biblioteca delle Biblioteche Prenestine. Punto Libery al piano terra.',
  },
  {
    qrToken: 'lazio-bib-artena',
    name: 'Biblioteca Comunale Artena',
    type: 'biblioteca',
    city: 'Artena',
    address: 'Via Cardinale Scipione Borghese',
    latitude: 41.7318,
    longitude: 13.0621,
    description: 'Biblioteca civica del comune di Artena. Scaffale Libery in ingresso.',
  },
  {
    qrToken: 'lazio-bib-trevignano',
    name: 'Biblioteca Comunale Trevignano Romano',
    type: 'biblioteca',
    city: 'Trevignano Romano',
    address: 'Largo Santa Caterina 1',
    latitude: 42.1555,
    longitude: 12.2422,
    description: 'Biblioteca sul lago di Bracciano a Trevignano. Angolo Libery con vista lago.',
  },
  {
    qrToken: 'lazio-bib-ariccia',
    name: 'Biblioteca Ariccia Punto Prestito',
    type: 'biblioteca',
    city: 'Ariccia',
    address: 'Corso Garibaldi 2',
    latitude: 41.7190,
    longitude: 12.6622,
    description: 'Punto prestito bibliotecario di Ariccia. Scaffale Libery integrato.',
  },
];

// ---------- 20 LIBRERIE ROMA E PROVINCIA ----------

const LIBRERIE: SeedPoint[] = [
  {
    qrToken: 'lazio-lib-feltrinelli-orlando',
    name: 'laFeltrinelli Via Orlando',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Vittorio Emanuele Orlando 84',
    latitude: 41.9047,
    longitude: 12.4908,
    description: 'Grande libreria Feltrinelli a due passi da Termini. Angolo Libery al piano terra.',
  },
  {
    qrToken: 'lazio-lib-fahrenheit-campofiori',
    name: 'Libreria Fahrenheit 451',
    type: 'libreria',
    city: 'Roma',
    address: 'Campo de\' Fiori 44',
    latitude: 41.8954,
    longitude: 12.4723,
    description: 'Libreria indipendente in Campo de\' Fiori. Scaffale bookcrossing sulla piazza.',
  },
  {
    qrToken: 'lazio-lib-altroquando',
    name: 'Libreria Altroquando',
    type: 'libreria',
    city: 'Roma',
    address: 'Via del Governo Vecchio 80',
    latitude: 41.8983,
    longitude: 12.4700,
    description: 'Libreria storica nel rione Parione. Punto Libery tra scaffali d\'antiquariato.',
  },
  {
    qrToken: 'lazio-lib-bibli-trastevere',
    name: 'Libreria Bibli Trastevere',
    type: 'libreria',
    city: 'Roma',
    address: 'Via dei Fienaroli 28',
    latitude: 41.8892,
    longitude: 12.4706,
    description: 'Libreria con caffè letterario a Trastevere. Angolo Libery aperto tutto il giorno.',
  },
  {
    qrToken: 'lazio-lib-arion-muse',
    name: 'Libreria Arion',
    type: 'libreria',
    city: 'Roma',
    address: 'Viale delle Muse 62',
    latitude: 41.9292,
    longitude: 12.5189,
    description: 'Libreria di quartiere nel Trieste. Scaffale bookcrossing dedicato all\'ingresso.',
  },
  {
    qrToken: 'lazio-lib-rinascita-parioli',
    name: 'Libreria Rinascita Parioli',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Archimede 41',
    latitude: 41.9224,
    longitude: 12.5122,
    description: 'Libreria storica del quartiere Parioli. Corner Libery sempre rifornito.',
  },
  {
    qrToken: 'lazio-lib-hoepli-torino',
    name: 'Libreria Hoepli Roma',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Torino 7',
    latitude: 41.9004,
    longitude: 12.4980,
    description: 'Sede romana della storica Hoepli. Bookcrossing al bancone d\'accoglienza.',
  },
  {
    qrToken: 'lazio-lib-grande-via-nazionale',
    name: 'Libreria La Grande Libreria',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Nazionale 254',
    latitude: 41.9001,
    longitude: 12.4947,
    description: 'Libreria multistoria su Via Nazionale. Scaffale Libery all\'ingresso.',
  },
  {
    qrToken: 'lazio-lib-nuova-europa-eur',
    name: 'Libreria Nuova Europa EUR',
    type: 'libreria',
    city: 'Roma',
    address: 'Viale Europa 82',
    latitude: 41.8323,
    longitude: 12.4726,
    description: 'Libreria di riferimento all\'EUR. Angolo Libery nella sezione narrativa.',
  },
  {
    qrToken: 'lazio-lib-ibs-termini',
    name: 'IBS Libraccio Termini',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Giolitti 238',
    latitude: 41.9010,
    longitude: 12.5015,
    description: 'Libreria a Termini con maxi scaffale dell\'usato. Punto Libery integrato.',
  },
  {
    qrToken: 'lazio-lib-mondadori-tritone',
    name: 'Mondadori Bookstore Via del Tritone',
    type: 'libreria',
    city: 'Roma',
    address: 'Via del Tritone 23',
    latitude: 41.9016,
    longitude: 12.4863,
    description: 'Mondadori centrale. Scaffale bookcrossing al piano superiore.',
  },
  {
    qrToken: 'lazio-lib-spazioterzomondo',
    name: 'Libreria Spazio Terzo Mondo',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Dandolo 10',
    latitude: 41.8885,
    longitude: 12.4731,
    description: 'Libreria indipendente a Trastevere. Scaffale Libery all\'aperto nel cortile.',
  },
  {
    qrToken: 'lazio-lib-prati-cola',
    name: 'Libreria Prati Libri',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Cola di Rienzo 190',
    latitude: 41.9084,
    longitude: 12.4655,
    description: 'Libreria nel cuore di Prati. Angolo Libery vicino alla cassa.',
  },
  {
    qrToken: 'lazio-lib-aventino-sbandati',
    name: 'Libreria Gli Sbandati',
    type: 'libreria',
    city: 'Roma',
    address: 'Via Marmorata 38',
    latitude: 41.8779,
    longitude: 12.4769,
    description: 'Libreria indipendente a Testaccio/Aventino. Bookcrossing nel dehors.',
  },
  {
    qrToken: 'lazio-lib-odradek-tivoli',
    name: 'Libreria Odradek Tivoli',
    type: 'libreria',
    city: 'Tivoli',
    address: 'Piazza Garibaldi 5',
    latitude: 41.9600,
    longitude: 12.7985,
    description: 'Libreria culturale nel centro di Tivoli. Punto Libery con vista sulle ville.',
  },
  {
    qrToken: 'lazio-lib-fenice-velletri',
    name: 'Libreria La Fenice Velletri',
    type: 'libreria',
    city: 'Velletri',
    address: 'Via Garibaldi 15',
    latitude: 41.6862,
    longitude: 12.7804,
    description: 'Libreria storica di Velletri. Scaffale Libery nel salottino lettura.',
  },
  {
    qrToken: 'lazio-lib-ancora-civitavecchia',
    name: 'Libreria L\'Ancora del Mediterraneo Civitavecchia',
    type: 'libreria',
    city: 'Civitavecchia',
    address: 'Corso Centocelle 44',
    latitude: 42.0935,
    longitude: 11.7966,
    description: 'Libreria portuale di Civitavecchia. Angolo Libery per i viaggiatori.',
  },
  {
    qrToken: 'lazio-lib-tempo-frascati',
    name: 'Libreria Il Tempo Libero Frascati',
    type: 'libreria',
    city: 'Frascati',
    address: 'Viale Vittorio Veneto 18',
    latitude: 41.8115,
    longitude: 12.6768,
    description: 'Libreria con enoteca nei Castelli Romani. Scaffale Libery in sala.',
  },
  {
    qrToken: 'lazio-lib-pagine-monterotondo',
    name: 'Libreria Pagine Vive Monterotondo',
    type: 'libreria',
    city: 'Monterotondo',
    address: 'Via Roma 25',
    latitude: 42.0540,
    longitude: 12.6221,
    description: 'Libreria indipendente di Monterotondo. Punto Libery integrato.',
  },
  {
    qrToken: 'lazio-lib-gutenberg-guidonia',
    name: 'Libreria Gutenberg Guidonia',
    type: 'libreria',
    city: 'Guidonia Montecelio',
    address: 'Viale Roma 110',
    latitude: 42.0098,
    longitude: 12.7143,
    description: 'Libreria scolastica e di narrativa a Guidonia. Scaffale bookcrossing.',
  },
];

// ---------- 20 CORNER NEL LAZIO ----------

const CORNER: SeedPoint[] = [
  {
    qrToken: 'lazio-corner-trastevere-trilussa',
    name: 'Corner Libery Piazza Trilussa',
    type: 'corner_free',
    city: 'Roma',
    address: 'Piazza Trilussa',
    latitude: 41.8895,
    longitude: 12.4690,
    description: 'Scaffale all\'aperto sotto il portico. Prendi un libro, lasciane un altro.',
  },
  {
    qrToken: 'lazio-corner-pigneto',
    name: 'Corner Libery Pigneto',
    type: 'corner_free',
    city: 'Roma',
    address: 'Via del Pigneto 32',
    latitude: 41.8825,
    longitude: 12.5373,
    description: 'Corner di quartiere al Pigneto. Sempre aperto, gestito dalla community.',
  },
  {
    qrToken: 'lazio-corner-flaminio',
    name: 'Corner Libery Flaminio',
    type: 'corner_free',
    city: 'Roma',
    address: 'Piazzale Flaminio 3',
    latitude: 41.9199,
    longitude: 12.4742,
    description: 'Casetta dei libri vicino al MAXXI. Scaffale ricaricato ogni settimana.',
  },
  {
    qrToken: 'lazio-corner-garbatella',
    name: 'Corner Libery Garbatella',
    type: 'corner_free',
    city: 'Roma',
    address: 'Piazza Benedetto Brin 5',
    latitude: 41.8643,
    longitude: 12.4882,
    description: 'Angolo bookcrossing nel lotto comunitario della Garbatella.',
  },
  {
    qrToken: 'lazio-corner-testaccio',
    name: 'Corner Libery Testaccio',
    type: 'corner_free',
    city: 'Roma',
    address: 'Via Nicola Zabaglia 25',
    latitude: 41.8791,
    longitude: 12.4790,
    description: 'Scaffale nel mercato di Testaccio. Orario del mercato.',
  },
  {
    qrToken: 'lazio-corner-sanlorenzo',
    name: 'Corner Libery San Lorenzo',
    type: 'corner_free',
    city: 'Roma',
    address: 'Via dei Volsci 85',
    latitude: 41.8925,
    longitude: 12.5207,
    description: 'Corner universitario a San Lorenzo. Frequentato da studenti La Sapienza.',
  },
  {
    qrToken: 'lazio-corner-prati',
    name: 'Corner Libery Prati',
    type: 'corner_free',
    city: 'Roma',
    address: 'Via Cola di Rienzo 14',
    latitude: 41.9084,
    longitude: 12.4655,
    description: 'Scaffale libero nel cuore di Prati. Aperto h24.',
  },
  {
    qrToken: 'lazio-corner-eur',
    name: 'Corner Libery EUR',
    type: 'corner_free',
    city: 'Roma',
    address: 'Piazza J.F. Kennedy 1',
    latitude: 41.8323,
    longitude: 12.4726,
    description: 'Casetta dei libri nel parco EUR. Custodita dai residenti.',
  },
  {
    qrToken: 'lazio-corner-ostiense',
    name: 'Corner Libery Ostiense',
    type: 'corner_free',
    city: 'Roma',
    address: 'Via Ostiense 145',
    latitude: 41.8617,
    longitude: 12.4800,
    description: 'Corner nel corridoio culturale Ostiense. Vicino al Macro Testaccio.',
  },
  {
    qrToken: 'lazio-corner-tiburtina',
    name: 'Corner Libery Tiburtina',
    type: 'corner_free',
    city: 'Roma',
    address: 'Via Tiburtina 190',
    latitude: 41.9012,
    longitude: 12.5354,
    description: 'Scaffale bookcrossing alla stazione Tiburtina. Sempre rifornito.',
  },
  {
    qrToken: 'lazio-corner-frascati-centro',
    name: 'Corner Libery Frascati Centro',
    type: 'corner_free',
    city: 'Frascati',
    address: 'Piazza del Mercato',
    latitude: 41.8108,
    longitude: 12.6770,
    description: 'Casetta dei libri in piazza del mercato di Frascati. Aperta 24/7.',
  },
  {
    qrToken: 'lazio-corner-tivoli-stazione',
    name: 'Corner Libery Tivoli Stazione',
    type: 'corner_free',
    city: 'Tivoli',
    address: 'Piazza Massimo 1',
    latitude: 41.9604,
    longitude: 12.7991,
    description: 'Scaffale alla stazione di Tivoli. Ideale per i pendolari.',
  },
  {
    qrToken: 'lazio-corner-anzio-riviera',
    name: 'Corner Libery Anzio Riviera',
    type: 'corner_free',
    city: 'Anzio',
    address: 'Viale della Vittoria 36',
    latitude: 41.4500,
    longitude: 12.6268,
    description: 'Casetta dei libri sul lungomare di Anzio. Aperta tutto l\'anno.',
  },
  {
    qrToken: 'lazio-corner-ladispoli-spiaggia',
    name: 'Corner Libery Ladispoli Lungomare',
    type: 'corner_free',
    city: 'Ladispoli',
    address: 'Lungomare dei Navigatori',
    latitude: 41.9537,
    longitude: 12.0738,
    description: 'Corner fronte mare a Ladispoli. Libri per l\'estate.',
  },
  {
    qrToken: 'lazio-corner-bracciano-centro',
    name: 'Corner Libery Bracciano Centro',
    type: 'corner_free',
    city: 'Bracciano',
    address: 'Piazza IV Novembre',
    latitude: 42.1048,
    longitude: 12.1762,
    description: 'Scaffale libero in piazza principale di Bracciano. Gestito dai volontari.',
  },
  {
    qrToken: 'lazio-corner-monterotondo-centro',
    name: 'Corner Libery Monterotondo',
    type: 'corner_free',
    city: 'Monterotondo',
    address: 'Via Roma 1',
    latitude: 42.0540,
    longitude: 12.6219,
    description: 'Corner nel centro di Monterotondo. Punto di riferimento dei lettori locali.',
  },
  {
    qrToken: 'lazio-corner-guidonia-centro',
    name: 'Corner Libery Guidonia',
    type: 'corner_free',
    city: 'Guidonia Montecelio',
    address: 'Piazza della Repubblica',
    latitude: 42.0094,
    longitude: 12.7148,
    description: 'Casetta dei libri in piazza principale di Guidonia.',
  },
  {
    qrToken: 'lazio-corner-colleferro',
    name: 'Corner Libery Colleferro',
    type: 'corner_free',
    city: 'Colleferro',
    address: 'Via della Stazione 15',
    latitude: 41.7290,
    longitude: 13.0075,
    description: 'Scaffale alla stazione di Colleferro. Per i pendolari della linea Roma-Napoli.',
  },
  {
    qrToken: 'lazio-corner-palestrina-piazza',
    name: 'Corner Libery Palestrina',
    type: 'corner_free',
    city: 'Palestrina',
    address: 'Piazza del Carmine',
    latitude: 41.8382,
    longitude: 12.8960,
    description: 'Corner nel centro storico prenestino. Vicino al museo.',
  },
  {
    qrToken: 'lazio-corner-civitavecchia-porto',
    name: 'Corner Libery Porto Civitavecchia',
    type: 'corner_free',
    city: 'Civitavecchia',
    address: 'Viale Garibaldi 40',
    latitude: 42.0935,
    longitude: 11.7968,
    description: 'Scaffale all\'imbarcadero. I passeggeri lasciano e prendono libri.',
  },
];

// ---------- TUTTI I PUNTI LAZIO ----------

const ALL_LAZIO_POINTS: SeedPoint[] = [...BIBLIOTECHE, ...LIBRERIE, ...CORNER];

// ---------- FETCH LIBRI DA GOOGLE BOOKS ----------

const QUERY_BUCKETS = [
  'inauthor:"italo calvino"',
  'inauthor:"umberto eco"',
  'inauthor:"andrea camilleri"',
  'inauthor:"elena ferrante"',
  'inauthor:"niccolo ammaniti"',
  'inauthor:"primo levi"',
  'inauthor:"alessandro baricco"',
  'inauthor:"dacia maraini"',
  'inauthor:"erri de luca"',
  'inauthor:"luigi pirandello"',
  'inauthor:"giovanni verga"',
  'inauthor:"dante alighieri"',
  'inauthor:"carlo collodi"',
  'inauthor:"grazia deledda"',
  'inauthor:"giuseppe tomasi di lampedusa"',
  'inauthor:"cesare pavese"',
  'inauthor:"alberto moravia"',
  'inauthor:"elsa morante"',
  'inauthor:"natalia ginzburg"',
  'inauthor:"giorgio bassani"',
  'subject:romanzo italiano',
  'subject:narrativa italiana',
  'subject:fiction italiano',
  'subject:thriller italiano',
  'subject:storia italia',
  'subject:poesia italiana',
  'subject:saggi italiani',
  'subject:giallo italiano',
  'subject:fantascienza italiano',
  'inauthor:"margaret mazzantini"',
  'inauthor:"giulio treves"',
  'inauthor:"antonio tabucchi"',
  'inauthor:"sebastiano vassalli"',
  'inauthor:"vincenzo consolo"',
  'inauthor:"andrea de carlo"',
  'inauthor:"gianrico carofiglio"',
  'inauthor:"massimo carlotto"',
  'inauthor:"andrea vitali"',
  'inauthor:"donato carrisi"',
  'inauthor:"maurizio de giovanni"',
];

const TARGET_BOOKS = 300;
const PAGE_SIZE = 40;

type LightBook = { isbn: string; title: string; author: string | null };

async function fetchIsbnsFromGoogleBooks(target: number): Promise<LightBook[]> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GOOGLE_BOOKS_API_KEY non configurata in .env');
  }

  const seen = new Set<string>();
  const out: LightBook[] = [];

  for (const q of QUERY_BUCKETS) {
    if (out.length >= target) break;
    for (let start = 0; start < 120 && out.length < target; start += PAGE_SIZE) {
      const url =
        `https://www.googleapis.com/books/v1/volumes` +
        `?q=${encodeURIComponent(q)}` +
        `&langRestrict=it&printType=books&orderBy=relevance` +
        `&maxResults=${PAGE_SIZE}&startIndex=${start}` +
        `&key=${encodeURIComponent(apiKey)}`;

      let res: Response;
      try {
        res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
      } catch (err) {
        console.warn(`  [${q}] fetch error:`, (err as Error).message);
        break;
      }
      if (!res.ok) { console.warn(`  [${q}] HTTP ${res.status}`); break; }

      const data = (await res.json()) as {
        items?: Array<{ volumeInfo?: { title?: string; authors?: string[]; industryIdentifiers?: Array<{ type?: string; identifier?: string }>; language?: string } }>;
      };
      if (!data.items?.length) break;

      for (const item of data.items) {
        const info = item.volumeInfo;
        if (!info?.title) continue;
        if (info.language && info.language !== 'it') continue;
        const raw = info.industryIdentifiers?.find(i => i.type === 'ISBN_13' || (i.identifier && i.identifier.length === 13))?.identifier;
        const isbn = raw ? normalizeIsbn(raw) : null;
        if (!isbn || seen.has(isbn)) continue;
        seen.add(isbn);
        out.push({ isbn, title: info.title, author: info.authors?.length ? info.authors.join(', ') : null });
        if (out.length >= target) break;
      }
      await new Promise(r => setTimeout(r, 150)); // rate limiting gentile
    }
  }
  return out;
}

// ---------- PRNG ----------

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]!);
  }
  return out;
}

// ---------- MAIN ----------

async function main() {
  console.log('Seed Lazio — 70 punti + 300 libri\n');

  // 0) Sospendi punti non laziali
  console.log('Sospendo punti fuori dal Lazio...');
  const allPoints = await prisma.point.findMany({ select: { id: true, name: true, city: true, status: true } });
  let sospesi = 0;
  for (const p of allPoints) {
    if (p.city && !LAZIO_CITIES.has(p.city) && p.status === 'approved') {
      await prisma.point.update({ where: { id: p.id }, data: { status: 'suspended' } });
      console.log(`  Sospeso: ${p.name} (${p.city})`);
      sospesi++;
    }
  }
  console.log(`  Punti sospesi: ${sospesi}\n`);

  // 1) Crea/aggiorna punti Lazio
  console.log('Creo punti Lazio...');
  const pointIds: string[] = [];
  for (const p of ALL_LAZIO_POINTS) {
    const opening = p.type === 'corner_free' ? openingCorner : openingStandard;
    const existing = await prisma.point.findFirst({ where: { qrToken: p.qrToken } });
    const point = existing
      ? await prisma.point.update({
          where: { id: existing.id },
          data: { name: p.name, type: p.type, status: 'approved', setupCompleted: true, address: p.address, city: p.city, latitude: p.latitude, longitude: p.longitude, description: p.description, openingHours: opening },
        })
      : await prisma.point.create({
          data: { name: p.name, type: p.type, status: 'approved', setupCompleted: true, address: p.address, city: p.city, latitude: p.latitude, longitude: p.longitude, description: p.description, openingHours: opening, approvedAt: new Date(), qrToken: p.qrToken },
        });
    pointIds.push(point.id);
    console.log(`  [${p.type.padEnd(11)}] ${p.name} (${p.city})`);
  }

  // 2) Libri da Google Books
  console.log(`\nRecupero ${TARGET_BOOKS} libri da Google Books...`);
  const lightBooks = await fetchIsbnsFromGoogleBooks(TARGET_BOOKS);
  console.log(`  ISBN distinti trovati: ${lightBooks.length}`);

  const persistedBookIds: string[] = [];
  let resolved = 0;
  let failures = 0;
  for (let i = 0; i < lightBooks.length; i++) {
    const lb = lightBooks[i]!;
    process.stdout.write(`  [${i + 1}/${lightBooks.length}] ${lb.isbn} ${lb.title.slice(0, 40)}… `);
    try {
      const r = await resolveBookByIsbn(lb.isbn);
      if (r.ok) {
        persistedBookIds.push(r.book.id);
        resolved++;
        process.stdout.write('ok\n');
      } else {
        failures++;
        process.stdout.write('miss\n');
      }
    } catch (err) {
      failures++;
      process.stdout.write(`errore\n`);
      console.warn('    ', (err as Error).message);
    }
  }
  console.log(`  Risolti: ${resolved}, falliti: ${failures}`);

  // 3) Distribuzione libri sui punti
  console.log('\nDistribuzione libri sui punti...');
  const rng = mulberry32(2024);
  let totalAssignments = 0;
  let totalCopies = 0;

  for (const bookId of persistedBookIds) {
    const numPoints = 3 + Math.floor(rng() * 5); // 3..7 punti per libro
    const chosen = pickRandom(pointIds, numPoints, rng);
    for (const pointId of chosen) {
      const idx = pointIds.indexOf(pointId);
      const pt = ALL_LAZIO_POINTS[idx];
      const copies = pt?.type === 'corner_free' ? 1 : 1 + Math.floor(rng() * 3);
      await prisma.pointBook.upsert({
        where: { pointId_bookId: { pointId, bookId } },
        create: { pointId, bookId, copies, status: 'active', firstAddedAt: new Date() },
        update: { copies, status: 'active' },
      });
      totalAssignments++;
      totalCopies += copies;
    }
  }

  // 4) Assegna responsabili demo ai punti Lazio
  console.log('\nAssegno responsabili demo...');
  const demoAssignments: Array<{ email: string; qrToken: string }> = [
    { email: 'biblio.gestore@libery.test',       qrToken: 'lazio-bib-mentana' },
    { email: 'gestore.alessandrina@libery.test',  qrToken: 'lazio-bib-tivoli-coccanari' },
    { email: 'gestore.anzio@libery.test',         qrToken: 'lazio-bib-anzio-cappell' },
  ];

  for (const { email, qrToken } of demoAssignments) {
    const manager = await prisma.user.findUnique({ where: { email } });
    if (!manager) { console.log(`  skip (non trovato): ${email}`); continue; }
    const pt = await prisma.point.findFirst({ where: { qrToken } });
    if (!pt) { console.log(`  skip (punto non trovato): ${qrToken}`); continue; }
    // Assegna solo se il punto non ha già un manager diverso
    if (pt.managerId && pt.managerId !== manager.id) {
      console.log(`  skip (già assegnato): ${pt.name}`);
      continue;
    }
    await prisma.point.update({
      where: { id: pt.id },
      data: { managerId: manager.id, setupCompleted: true },
    });
    if (manager.role !== 'point_manager') {
      await prisma.user.update({ where: { id: manager.id }, data: { role: 'point_manager' } });
    }
    console.log(`  ✓ ${manager.displayName ?? email} → ${pt.name}`);
  }

  console.log('\nRiepilogo:');
  console.log(`  Punti Lazio creati/aggiornati: ${pointIds.length}`);
  console.log(`  Libri in catalogo: ${persistedBookIds.length}`);
  console.log(`  Righe inventario: ${totalAssignments}`);
  console.log(`  Copie totali: ${totalCopies}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
