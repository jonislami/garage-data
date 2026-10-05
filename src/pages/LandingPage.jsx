import { useState } from 'react';
import {
  WifiOff, FileText, ClipboardCheck, Package, ArrowRight, Phone, MessageSquare, ShieldCheck, Check,
  BarChart3, QrCode, Receipt, CalendarDays, Wrench, ChevronDown, Smartphone, Languages,
  UserPlus, Sparkles, Menu, X, Monitor, Share, PlusSquare, MoreVertical, Download,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import InstallApp from '../components/InstallApp';

const PHONE_DISPLAY = '+383 48 323 740';
const PHONE_LINK = '+38348323740';
const WHATSAPP = 'https://wa.me/38348323740';

// A screenshot inside a simple browser window
function BrowserFrame({ src, alt, eager }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-blue-900/10">
      <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
      </div>
      <img src={src} alt={alt} width="1600" height="1000" className="block w-full h-auto" loading={eager ? 'eager' : 'lazy'} />
    </div>
  );
}

// A screenshot inside a phone outline
function PhoneFrame({ src, alt, eager }) {
  return (
    <div className="overflow-hidden rounded-[1.6rem] border-[6px] border-gray-800 bg-gray-800 shadow-2xl">
      <img src={src} alt={alt} width="585" height="1266" className="block w-full h-auto rounded-[1.1rem]" loading={eager ? 'eager' : 'lazy'} />
    </div>
  );
}

export default function LandingPage({ onLoginClick }) {
  const { language, setLanguage } = useLanguage();
  const al = language === 'al';
  const L = (sq, en) => (al ? sq : en);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shot, setShot] = useState(0);
  const [openFaq, setOpenFaq] = useState(0);

  const navLinks = [
    { id: 'features', label: L('Veçoritë', 'Features') },
    { id: 'qr', label: L('Servisi me QR', 'QR service') },
    { id: 'how', label: L('Si funksionon', 'How it works') },
    { id: 'install', label: L('Shkarko', 'Install') },
    { id: 'faq', label: L('Pyetje', 'FAQ') },
    { id: 'contact', label: L('Kontakti', 'Contact') },
  ];

  const features = [
    { icon: FileText, title: L('Punë dhe fatura', 'Jobs & invoices'), desc: L('Fletë pune me punë dore dhe pjesë. Printoni faturën ose dërgojeni në WhatsApp me një klik.', 'Job cards with labour and parts. Print the invoice or send it on WhatsApp in one click.') },
    { icon: Receipt, title: L('Fatura të rregullta', 'Regular (fiscal) invoices'), desc: L('Nr. fiskal, nr. unik dhe TVSH për ju dhe blerësin, me numërim të veçantë çdo muaj (01/102026…).', 'Fiscal, unique and VAT numbers for you and the buyer, with separate monthly numbering (01/102026…).') },
    { icon: QrCode, title: L('Historia e servisit me QR', 'Service history with QR'), desc: L('Një QR i përhershëm për çdo veturë. Klienti skanon dhe sheh çfarë u ndërrua dhe kur i skadon servisi.', 'One permanent QR per vehicle. The customer scans it and sees what was changed and when service is due.') },
    { icon: Package, title: L('Stoku i pjesëve', 'Parts inventory'), desc: L('Kërkim sipas numrit të pjesës, stoku i ulët dhe marzha e fitimit për çdo artikull.', 'Search by part number, spot low stock and see the margin on every item.') },
    { icon: ClipboardCheck, title: L('Inspektime', 'Inspections'), desc: L('Shënoni dëmtimet mbi diagramin e veturës në tabletë, para klientit.', 'Mark damage on the vehicle diagram on a tablet, in front of the customer.') },
    { icon: CalendarDays, title: L('Takimet', 'Appointments'), desc: L('Kalendar i thjeshtë për vizitat e ardhshme të klientëve.', 'A simple calendar for upcoming customer visits.') },
    { icon: BarChart3, title: L('Raporte financiare', 'Financial reports'), desc: L('Të ardhurat, kostoja e pjesëve dhe shpenzimet sipas muajit dhe vitit.', 'Revenue, parts cost and expenses by month and year.') },
    { icon: WifiOff, title: L('Punon edhe offline', 'Works offline'), desc: L('Pa internet vazhdoni punën; gjithçka sinkronizohet kur lidheni sërish. Kopje rezervë me një klik.', 'Keep working without internet; everything syncs when you are back. One-click backups.') },
  ];

  const gallery = [
    { img: '/screens/ballina.webp', t: L('Ballina', 'Dashboard'), d: L('Të ardhurat e ditës, punët e hapura dhe muaji me një shikim.', 'Today’s revenue, open jobs and the month at a glance.') },
    { img: '/screens/punet.webp', t: L('Punët', 'Jobs'), d: L('Ndiqni çdo riparim nga “në pritje” deri te “përfunduar”.', 'Track every repair from pending to completed.') },
    { img: '/screens/fatura.webp', t: L('Fatura e rregullt', 'Regular invoice'), d: L('Nr. fiskal, nr. unik dhe TVSH për ju dhe blerësin, me numërim të veçantë çdo muaj.', 'Fiscal, unique and VAT numbers for you and the buyer, with monthly numbering.') },
    { img: '/screens/servisi-qr.webp', t: L('Servisi & QR', 'Service & QR'), d: L('Çfarë u ndërrua, në sa km, dhe kur skadon çdo pjesë.', 'What was changed, at what mileage, and when each item is due.') },
    { img: '/screens/inventari.webp', t: L('Inventari', 'Inventory'), d: L('Sasitë, kostot e blerjes dhe marzhet.', 'Stock levels, purchase costs and margins.') },
    { img: '/screens/raportet.webp', t: L('Raportet', 'Reports'), d: L('Të ardhurat dhe shpenzimet sipas ditës dhe muajit.', 'Income and expenses by day and month.') },
    { img: '/screens/klientet.webp', t: L('Klientët', 'Clients'), d: L('Kontaktet dhe veturat e çdo klienti, edhe klientë biznes.', 'Contact details and vehicles for every customer, including businesses.') },
  ];

  const steps = [
    { icon: Phone, title: L('Na kontaktoni', 'Contact us'), desc: L('Na telefononi ose shkruani në WhatsApp. Ju tregojmë aplikacionin.', 'Call or message us on WhatsApp. We show you the app.') },
    { icon: UserPlus, title: L('Ju hapim llogarinë', 'We open your account'), desc: L('Me logon dhe të dhënat e ofiçinës suaj, gati për provë falas.', 'With your logo and workshop details, ready for a free trial.') },
    { icon: Wrench, title: L('Filloni punën', 'Start working'), desc: L('Fletë pune, fatura, stok dhe QR për çdo veturë — nga dita e parë.', 'Job cards, invoices, stock and a QR for every vehicle — from day one.') },
  ];

  const installGuides = [
    {
      icon: Smartphone, title: 'iPhone / iPad', note: L('Vetëm me Safari', 'Safari only'),
      steps: [
        <>{L('Hapni', 'Open')} <b>Safari</b> {L('dhe shkoni te kjo faqe', 'and go to this page')}</>,
        <>{L('Prekni butonin', 'Tap the')} <Share size={15} className="inline -mt-0.5 text-blue-600" /> <b>{L('Ndaj (Share)', 'Share')}</b> {L('poshtë në mes', 'button at the bottom')}</>,
        <>{L('Rrëshqitni poshtë dhe prekni', 'Scroll down and tap')} <PlusSquare size={15} className="inline -mt-0.5" /> <b>{L('Shto në ekranin bazë', 'Add to Home Screen')}</b></>,
        <>{L('Prekni', 'Tap')} <b>{L('Shto (Add)', 'Add')}</b> {L('lart djathtas', 'in the top right')}</>,
      ],
    },
    {
      icon: Smartphone, title: 'Android', note: L('Me Chrome', 'With Chrome'),
      steps: [
        <>{L('Hapni', 'Open')} <b>Chrome</b> {L('dhe shkoni te kjo faqe', 'and go to this page')}</>,
        <>{L('Prekni', 'Tap')} <Download size={15} className="inline -mt-0.5 text-blue-600" /> <b>{L('Shkarko aplikacionin', 'Install the app')}</b></>,
        <>{L('Ose: menyja', 'Or: the')} <MoreVertical size={15} className="inline -mt-0.5" /> {L('lart djathtas →', 'menu (top right) →')} <b>{L('Instalo aplikacionin', 'Install app')}</b></>,
        <>{L('Prekni', 'Tap')} <b>{L('Instalo', 'Install')}</b></>,
      ],
    },
    {
      icon: Monitor, title: L('Kompjuter', 'Computer'), note: 'Chrome / Edge',
      steps: [
        <>{L('Hapni këtë faqe në', 'Open this page in')} <b>Chrome</b> {L('ose', 'or')} <b>Edge</b></>,
        <>{L('Klikoni', 'Click')} <Download size={15} className="inline -mt-0.5 text-blue-600" /> <b>{L('Shkarko aplikacionin', 'Install the app')}</b> {L('ose ikonën e instalimit në shiritin e adresës', 'or the install icon in the address bar')}</>,
        <>{L('Klikoni', 'Click')} <b>{L('Instalo', 'Install')}</b></>,
        <>{L('Aplikacioni hapet në dritaren e vet, me ikonë në desktop', 'The app opens in its own window, with a desktop icon')}</>,
      ],
    },
  ];
  const faqs = [
    { q: L('A duhet të instaloj diçka?', 'Do I need to install anything?'), a: L('Jo. GarageData hapet në shfletues në kompjuter, tabletë ose telefon. Me butonin “Shkarko aplikacionin” e instaloni në kompjuter ose telefon dhe hapet si aplikacion, me ikonën e vet. Hapat për iPhone, Android dhe kompjuter i gjeni te pjesa “Shkarko aplikacionin” më lart.', 'No. GarageData runs in the browser on a computer, tablet or phone. With the “Install the app” button it installs on a computer or phone and opens like an app, with its own icon. The steps for iPhone, Android and computer are in the “Install the app” section above.') },
    { q: L('Çfarë ndodh kur nuk ka internet?', 'What happens without internet?'), a: L('Vazhdoni të punoni normalisht. Ndryshimet ruhen në pajisje dhe sinkronizohen automatikisht kur kthehet interneti.', 'You keep working normally. Changes are stored on the device and sync automatically when the connection is back.') },
    { q: L('A janë të sigurta të dhënat e mia?', 'Is my data safe?'), a: L('Çdo ofiçinë sheh vetëm të dhënat e veta. Të dhënat ruhen në server të sigurt dhe mund të shkarkoni kopje rezervë kurdo.', 'Each workshop sees only its own data. Data is stored on secure servers and you can download a backup at any time.') },
    { q: L('Si funksionon QR kodi i veturës?', 'How does the vehicle QR code work?'), a: L('Printoni një herë stikerin për veturën. Sa herë që regjistroni servis të ri, faqja e QR përditësohet vetë — pa printuar QR të ri.', 'Print the sticker once per vehicle. Every time you record a new service, the QR page updates itself — no new QR needed.') },
    { q: L('A mund të lëshoj fatura të rregullta me nr. fiskal?', 'Can I issue regular invoices with a fiscal number?'), a: L('Po. Plotësoni nr. fiskal, nr. unik dhe TVSH te Cilësimet dhe te klientët biznes. Faturat e rregullta kanë numërim të veçantë çdo muaj.', 'Yes. Fill in your fiscal, unique and VAT numbers in Settings and for business clients. Regular invoices get their own monthly numbering.') },
    { q: L('Sa kushton?', 'How much does it cost?'), a: L('Fillimisht e provoni falas. Pastaj ju ofrojmë një çmim sipas madhësisë së ofiçinës — na kontaktoni në telefon ose WhatsApp.', 'You try it free first. After that we offer a price based on the size of your workshop — call or message us on WhatsApp.') },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <a href="#" className="flex items-center gap-2.5 shrink-0">
            <img src="/icons/icon-192.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-base font-semibold tracking-tight">Garage<span className="text-blue-600">Data</span></span>
          </a>
          <nav className="hidden lg:flex items-center gap-6 text-sm text-gray-600">
            {navLinks.map(l => <a key={l.id} href={`#${l.id}`} className="hover:text-gray-900 transition-colors">{l.label}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setLanguage(al ? 'en' : 'al')} className="btn btn-ghost btn-sm font-code" aria-label="Language">{al ? 'EN' : 'SQ'}</button>
            <InstallApp al={al} className="btn btn-ghost hidden md:inline-flex" label={L('Shkarko', 'Install')} />
            <a href="#contact" className="btn btn-secondary hidden sm:inline-flex">{L('Provë falas', 'Free trial')}</a>
            <button onClick={onLoginClick} className="btn btn-primary">{L('Kyçu', 'Log in')}</button>
            <button onClick={() => setMenuOpen(o => !o)} className="btn-icon lg:hidden" aria-label="Menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
          </div>
        </div>
        {menuOpen && (
          <nav className="lg:hidden border-t border-gray-200 bg-white px-4 py-2">
            {navLinks.map(l => (
              <a key={l.id} href={`#${l.id}`} onClick={() => setMenuOpen(false)} className="block py-2.5 text-sm text-gray-700">{l.label}</a>
            ))}
          </nav>
        )}
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-b from-blue-50/70 via-white to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 md:pt-20 md:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-medium text-blue-700">
              <Sparkles size={13} /> {L('E re: historia e servisit me QR për çdo veturë', 'New: QR service history for every vehicle')}
            </span>
            <h1 className="mt-5 text-4xl md:text-[3.25rem] font-semibold tracking-tight leading-[1.08] text-gray-900">
              {L('Ofiçina juaj, e organizuar.', 'Your workshop, organised.')}{' '}
              <span className="text-blue-600">{L('Klientët, të kthyer.', 'Customers, coming back.')}</span>
            </h1>
            <p className="mt-5 text-lg text-gray-600 max-w-xl leading-relaxed">
              {L(
                'Punët, faturat, stoku dhe historia e servisit në një vend — në shqip, në çdo pajisje, edhe pa internet. Klientët skanojnë QR-në në veturë dhe e dinë kur t’ju kthehen.',
                'Jobs, invoices, stock and service history in one place — in Albanian, on any device, even offline. Customers scan the QR in their car and know when to come back.',
              )}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg"><MessageSquare size={16} /> {L('Kërko provë falas', 'Request a free trial')}</a>
              <a href="#qr" className="btn btn-secondary btn-lg">{L('Shiko si funksionon', 'See how it works')} <ArrowRight size={16} /></a>
              <InstallApp al={al} className="btn btn-secondary btn-lg" />
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
              {[L('Provë falas', 'Free trial'), L('Ju ndihmojmë me fillimin', 'We help you get started'), L('Në shqip', 'In Albanian')].map(x => (
                <li key={x} className="flex items-center gap-1.5"><Check size={15} className="text-emerald-600" /> {x}</li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <BrowserFrame src="/screens/ballina.webp" alt={L('GarageData — ballina', 'GarageData — dashboard')} eager />
            <div className="absolute -bottom-8 right-2 sm:-right-4 w-[26%] min-w-[7rem] max-w-[11rem]">
              <PhoneFrame src="/screens/qr-telefon.webp" alt={L('Faqja e QR në telefon', 'QR page on a phone')} eager />
            </div>
            {/* Floating card */}
            <div className="hidden sm:flex absolute -left-4 -bottom-6 items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-50 text-emerald-600"><Receipt size={18} /></span>
              <div className="text-sm">
                <p className="font-medium text-gray-900">{L('Faturë e rregullt', 'Regular invoice')}</p>
                <p className="font-code text-xs text-gray-500">01/102026 · €145,00</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS STRIP */}
      <section className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { icon: Languages, t: L('Shqip & anglisht', 'Albanian & English') },
            { icon: Smartphone, t: L('Kompjuter, tabletë, telefon', 'Desktop, tablet, phone') },
            { icon: WifiOff, t: L('Punon edhe offline', 'Works offline') },
            { icon: ShieldCheck, t: L('Të dhëna të sigurta', 'Secure data') },
          ].map(h => (
            <div key={h.t} className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700"><h.icon size={17} /></span>
              {h.t}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-blue-700">{L('Veçoritë', 'Features')}</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{L('Gjithçka që një ofiçinë përdor çdo ditë', 'Everything a workshop uses every day')}</h2>
            <p className="mt-3 text-gray-600">{L('Pa letra, pa tabela Excel, pa harruar asgjë.', 'No paper, no spreadsheets, nothing forgotten.')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map(f => (
              <div key={f.title} className="rounded-xl border border-gray-200 p-5 hover:border-blue-200 hover:shadow-md transition">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><f.icon size={20} strokeWidth={1.75} /></span>
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QR SPOTLIGHT */}
      <section id="qr" className="py-16 md:py-24 border-b border-gray-200 bg-gray-900 text-white scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-blue-300">{L('Historia e servisit me QR', 'QR service history')}</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-white">{L('Një stiker. Klientë që kthehen vetë.', 'One sticker. Customers who come back on their own.')}</h2>
            <p className="mt-4 text-gray-300 leading-relaxed">
              {L(
                'Mekaniku zgjedh çfarë u ndërrua — vaji, filtrat, frenat ose çdo pjesë tjetër — dhe intervalin në km ose muaj. Sistemi llogarit vetë kur skadon çdo pjesë.',
                'The mechanic ticks what was changed — oil, filters, brakes or any other part — and the interval in km or months. The system works out when each item is due.',
              )}
            </p>
            <ul className="mt-6 space-y-3 text-sm text-gray-200">
              {[
                L('QR i përhershëm: printohet një herë dhe vlen me vite', 'Permanent QR: printed once, valid for years'),
                L('Klienti sheh pjesët e ndërruara, km dhe datën e servisit të radhës', 'The customer sees changed parts, mileage and the next due date'),
                L('Paralajmërim për pjesët që skadojnë ose janë vonuar, me buton për t’ju telefonuar', 'Warnings for items due soon or overdue, with a button to call you'),
                L('Stikeri ka logon, telefonin, uebfaqen dhe adresën tuaj', 'The sticker carries your logo, phone, website and address'),
              ].map(x => <li key={x} className="flex gap-2"><Check size={17} className="mt-0.5 shrink-0 text-emerald-400" /> {x}</li>)}
            </ul>
          </div>

          {/* The real customer page on a phone */}
          <div className="mx-auto w-full max-w-[17rem]">
            <PhoneFrame src="/screens/qr-telefon.webp" alt={L('Faqja që sheh klienti kur skanon QR-në', 'The page the customer sees after scanning the QR')} />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-16 md:py-24 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-medium text-blue-700">{L('Si funksionon', 'How it works')}</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{L('Gati për punë sot', 'Ready to work today')}</h2>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, idx) => (
              <li key={s.title} className="relative rounded-xl border border-gray-200 p-6">
                <span className="absolute right-5 top-4 font-code text-4xl font-semibold text-gray-100">{idx + 1}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white"><s.icon size={19} /></span>
                <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg"><MessageSquare size={16} /> {L('Kërko provë falas', 'Request a free trial')}</a>
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section id="gallery" className="py-16 md:py-24 bg-gray-50 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-8">
            <p className="text-sm font-medium text-blue-700">{L('Pamje', 'Screenshots')}</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{L('Ndërfaqe e qartë, e ndërtuar për ofiçinë', 'A clear interface, built for the workshop')}</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" role="tablist">
            {gallery.map((g, idx) => (
              <button key={g.img} role="tab" aria-selected={shot === idx} onClick={() => setShot(idx)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${shot === idx ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:text-gray-900'}`}>
                {g.t}
              </button>
            ))}
          </div>
          <figure className="mt-6">
            <BrowserFrame src={gallery[shot].img} alt={gallery[shot].t} />
            <figcaption className="mt-4 text-center text-sm text-gray-600">{gallery[shot].d}</figcaption>
          </figure>
        </div>
      </section>

      {/* INSTALL */}
      <section id="install" className="py-16 md:py-24 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-medium text-blue-700">{L('Shkarko aplikacionin', 'Install the app')}</p>
            <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{L('Në telefon dhe kompjuter, direkt nga shfletuesi', 'On your phone and computer, straight from the browser')}</h2>
            <p className="mt-3 text-gray-600 leading-relaxed">{L('Pa App Store dhe pa skedarë për shkarkim. GarageData merr ikonën e vet, hapet si aplikacion dhe përditësohet vetë.', 'No App Store and no files to download. GarageData gets its own icon, opens like an app and updates itself.')}</p>
            <div className="mt-5"><InstallApp al={al} className="btn btn-primary btn-lg" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {installGuides.map(g => (
              <div key={g.title} className="rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white"><g.icon size={19} /></span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{g.title}</h3>
                    <p className="text-xs text-gray-500">{g.note}</p>
                  </div>
                </div>
                <ol className="mt-5 space-y-3 text-sm text-gray-700">
                  {g.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700">{idx + 1}</span>
                      <span className="pt-0.5 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 md:py-24 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <p className="text-sm font-medium text-blue-700">{L('Pyetje', 'FAQ')}</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">{L('Pyetjet më të shpeshta', 'Frequently asked questions')}</h2>
          <div className="mt-8 divide-y divide-gray-200 border-y border-gray-200">
            {faqs.map((f, idx) => (
              <div key={f.q}>
                <button onClick={() => setOpenFaq(openFaq === idx ? -1 : idx)} aria-expanded={openFaq === idx}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium text-gray-900">
                  {f.q}
                  <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && <p className="pb-4 text-sm text-gray-600 leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT / FINAL CTA */}
      <section id="contact" className="py-16 md:py-24 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-900 text-white p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">{L('Kërkoni një provë falas', 'Ask for a free trial')}</h2>
              <p className="mt-3 text-blue-100 leading-relaxed">
                {L(
                  'Na telefononi ose na shkruani në WhatsApp. Ju tregojmë aplikacionin, ju hapim llogarinë dhe çmimi përshtatet sipas ofiçinës suaj.',
                  'Call or message us on WhatsApp. We show you the app, open your account, and pricing fits the size of your workshop.',
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row md:items-end lg:justify-end gap-3">
              <a href={`tel:${PHONE_LINK}`} className="btn btn-lg bg-white border-white text-blue-800 hover:bg-blue-50"><Phone size={16} /> {PHONE_DISPLAY}</a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-lg btn-success"><MessageSquare size={16} /> WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 object-contain" />
            <span>© {new Date().getFullYear()} GarageData · {L('Softuer për servise dhe ofiçina', 'Software for auto repair shops')}</span>
          </div>
          <div className="flex gap-4">
            <a href={`tel:${PHONE_LINK}`} className="hover:text-gray-900">{PHONE_DISPLAY}</a>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="hover:text-gray-900">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
