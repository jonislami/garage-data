import { WifiOff, FileText, ClipboardCheck, Package, ArrowRight, Phone, MessageSquare, ShieldCheck, Check, BarChart3 } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

const PHONE_DISPLAY = '+383 48 323 740';
const PHONE_LINK = '+38348323740';
const WHATSAPP = 'https://wa.me/38348323740';

export default function LandingPage({ onLoginClick }) {
  const { language, setLanguage } = useLanguage();
  const al = language === 'al';

  const navLinks = [
    { id: 'features', al: 'Veçoritë', en: 'Features' },
    { id: 'gallery', al: 'Pamje', en: 'Screenshots' },
    { id: 'contact', al: 'Kontakti', en: 'Contact' },
  ];

  const features = [
    {
      icon: FileText,
      title: al ? 'Punë dhe fatura' : 'Jobs & invoices',
      desc: al ? 'Krijoni fletë pune, shtoni punën dhe pjesët, printoni ose dërgoni faturën në WhatsApp.' : 'Create job cards, add labour and parts, then print the invoice or send it on WhatsApp.',
    },
    {
      icon: Package,
      title: al ? 'Stoku i pjesëve' : 'Parts inventory',
      desc: al ? 'Kërkoni sipas numrit të pjesës, shihni stokun e ulët dhe marzhen e fitimit për çdo artikull.' : 'Search by part number, spot low stock and see the margin on every item.',
    },
    {
      icon: ClipboardCheck,
      title: al ? 'Inspektime' : 'Vehicle inspections',
      desc: al ? 'Shënoni dëmtimet mbi diagramin e veturës në tabletë, para klientit.' : 'Mark damage on the vehicle diagram on a tablet, in front of the customer.',
    },
    {
      icon: WifiOff,
      title: al ? 'Punon edhe offline' : 'Works offline',
      desc: al ? 'Pa internet mund të vazhdoni punën; ndryshimet sinkronizohen kur lidheni sërish.' : 'Keep working without internet; changes sync as soon as you are back online.',
    },
    {
      icon: ShieldCheck,
      title: al ? 'Kopje rezervë' : 'Backup & restore',
      desc: al ? 'Shkarkoni një kopje të klientëve, stokut dhe faturave dhe riktheni kur ju duhet.' : 'Download a copy of clients, stock and invoices, and restore it whenever you need to.',
    },
    {
      icon: BarChart3,
      title: al ? 'Raporte financiare' : 'Financial reports',
      desc: al ? 'Të ardhurat, kostoja e pjesëve dhe shpenzimet sipas muajit dhe vitit.' : 'Revenue, parts cost and expenses by month and year.',
    },
  ];

  const gallery = [
    { img: '/dashbordi.jpg', t: ['Dashboard', 'Ballina'], d: ['Today’s revenue, open jobs and the month at a glance.', 'Të ardhurat e ditës, punët e hapura dhe muaji me një shikim.'] },
    { img: '/Sherbimet.jpg', t: ['Jobs', 'Punët'], d: ['Track every repair from pending to completed.', 'Ndiqni çdo riparim nga “në pritje” deri te “përfunduar”.'] },
    { img: '/inventari.jpg', t: ['Inventory', 'Inventari'], d: ['Stock levels, purchase costs and margins.', 'Sasitë, kostot e blerjes dhe marzhet.'] },
    { img: '/veturat.jpg', t: ['Vehicles & VIN', 'Veturat & VIN'], d: ['Register vehicles quickly with VIN decoding.', 'Regjistroni veturat shpejt me dekodim të VIN-it.'] },
    { img: '/kilentet.jpg', t: ['Clients', 'Klientët'], d: ['Contact details and vehicles for every customer.', 'Kontaktet dhe veturat e çdo klienti.'] },
    { img: '/takimet.jpg', t: ['Appointments', 'Takimet'], d: ['A simple calendar for upcoming visits.', 'Kalendar i thjeshtë për vizitat e ardhshme.'] },
    { img: '/shpenzimet.jpg', t: ['Expenses', 'Shpenzimet'], d: ['Rent, electricity, tools and other shop costs.', 'Qiraja, rryma, veglat dhe kostot tjera.'] },
    { img: '/raportet.jpg', t: ['Reports', 'Raportet'], d: ['Monthly and yearly income and expenses.', 'Të ardhurat dhe shpenzimet mujore e vjetore.'] },
  ];
  const i = al ? 1 : 0;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <img src="/applogo.png" alt="" className="h-8 w-8 object-contain" />
            <span className="text-base font-semibold tracking-tight">Garage<span className="text-blue-600">Data</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm text-gray-600">
            {navLinks.map(l => <a key={l.id} href={`#${l.id}`} className="hover:text-gray-900 transition-colors">{al ? l.al : l.en}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setLanguage(al ? 'en' : 'al')} className="btn btn-ghost btn-sm font-code">{al ? 'EN' : 'SQ'}</button>
            <button onClick={onLoginClick} className="btn btn-primary">{al ? 'Kyçu' : 'Log in'}</button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-blue-700 mb-4">{al ? 'Softuer për servise dhe ofiçina' : 'Software for auto repair shops'}</p>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] text-gray-900">
              {al ? 'Punët, faturat dhe stoku i ofiçinës në një vend.' : 'Jobs, invoices and stock for your workshop, in one place.'}
            </h1>
            <p className="mt-5 text-lg text-gray-600 max-w-xl leading-relaxed">
              {al
                ? 'GarageData ju ndihmon të regjistroni punët, të lëshoni fatura, të ndiqni pjesët dhe të dini sa fitoni çdo muaj — edhe kur interneti mungon.'
                : 'GarageData helps you record jobs, issue invoices, track parts and know what you earn each month — even when the internet is down.'}
            </p>
            <ul className="mt-6 space-y-2 text-sm text-gray-700">
              {(al
                ? ['Në shqip dhe anglisht', 'Funksionon në kompjuter, tabletë dhe telefon', 'Kopje rezervë e të dhënave me një klik']
                : ['Albanian and English', 'Works on desktop, tablet and phone', 'One-click data backup']
              ).map(x => <li key={x} className="flex items-center gap-2"><Check size={16} className="text-emerald-600" /> {x}</li>)}
            </ul>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="#contact" className="btn btn-primary btn-lg">{al ? 'Kërko ofertë' : 'Request an offer'} <ArrowRight size={16} /></a>
              <a href="#gallery" className="btn btn-secondary btn-lg">{al ? 'Shiko aplikacionin' : 'See the app'}</a>
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-xl">
            <img src="/dashbordi.jpg" alt="GarageData dashboard" className="w-full h-auto rounded" />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-20 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-semibold tracking-tight">{al ? 'Çfarë përfshin' : 'What’s included'}</h2>
            <p className="mt-3 text-gray-600">{al ? 'Mjetet që një ofiçinë përdor çdo ditë, pa komplikime.' : 'The tools a workshop uses every day, without the clutter.'}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-gray-200">
            {features.map(f => (
              <div key={f.title} className="p-6 border-r border-b border-gray-200">
                <f.icon size={20} className="text-blue-600" strokeWidth={1.75} />
                <h3 className="mt-4 font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section id="gallery" className="py-16 md:py-20 bg-gray-50 border-b border-gray-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl font-semibold tracking-tight">{al ? 'Pamje nga aplikacioni' : 'Inside the app'}</h2>
            <p className="mt-3 text-gray-600">{al ? 'Ndërfaqe e qartë, e ndërtuar për përdorim të përditshëm në ofiçinë.' : 'A clear interface built for everyday use in the workshop.'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
            {gallery.map(g => (
              <figure key={g.img}>
                <div className="rounded-lg border border-gray-200 bg-white p-2">
                  <img src={g.img} alt={g.t[i]} className="w-full h-auto rounded" loading="lazy" />
                </div>
                <figcaption className="mt-4">
                  <p className="font-semibold text-gray-900">{g.t[i]}</p>
                  <p className="mt-1 text-sm text-gray-600">{g.d[i]}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-16 md:py-20 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-lg bg-gray-900 text-white p-8 md:p-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">{al ? 'Kërkoni një ofertë' : 'Request an offer'}</h2>
              <p className="mt-3 text-gray-300 leading-relaxed">
                {al
                  ? 'Na telefononi ose na shkruani në WhatsApp. Ju tregojmë aplikacionin dhe ju japim një çmim sipas nevojave të ofiçinës suaj.'
                  : 'Call us or message us on WhatsApp. We’ll show you the app and give you a price based on your workshop’s needs.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:justify-end gap-3">
              <a href={`tel:${PHONE_LINK}`} className="btn btn-lg bg-white border-white text-gray-900 hover:bg-gray-100"><Phone size={16} /> {PHONE_DISPLAY}</a>
              <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn btn-lg btn-success"><MessageSquare size={16} /> WhatsApp</a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row justify-between gap-2 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} GarageData</p>
          <p>{al ? 'Të gjitha të drejtat e rezervuara.' : 'All rights reserved.'}</p>
        </div>
      </footer>
    </div>
  );
}
