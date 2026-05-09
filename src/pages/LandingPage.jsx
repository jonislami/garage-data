import { motion } from 'framer-motion';
import { Wrench, WifiOff, FileText, BarChart3, Zap, CheckCircle, ArrowRight, Play, Globe, PhoneCall, MessageSquare } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

// --- KONFIGURIMET E ANIMACIONEVE ---
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.2 } }
};

export default function LandingPage({ onLoginClick }) {
  const { language, setLanguage } = useLanguage();
  const isAl = language === 'al';

  const toggleLanguage = () => {
    const newLang = isAl ? 'en' : 'al';
    setLanguage(newLang);
    localStorage.setItem('sonic_language', newLang);
  };

  const navLinks = [
    { id: 'features', al: 'Veçoritë', en: 'Features' },
    { id: 'gallery', al: 'Pamje nga App', en: 'App Gallery' },
    { id: 'contact', al: 'Ofertat', en: 'Get an Offer' }
  ];

  const features = [
    { 
      icon: WifiOff, 
      title: isAl ? 'Punon Offline-First' : 'Offline-First Architecture', 
      desc: isAl ? 'S\'ka internet? S\'ka problem. Punoni pa ndërprerje, të dhënat sinkronizohen sapo lidheni.' : 'No internet? No problem. Work seamlessly, data syncs automatically when you reconnect.' 
    },
    { 
      icon: FileText, 
      title: isAl ? 'Faturim & Raporte' : '1-Click Invoicing & Reports', 
      desc: isAl ? 'Gjeneroni fatura profesionale dhe shihni fitimet tuaja me grafikë të detajuar.' : 'Generate professional invoices and track your profits with detailed visual charts.' 
    },
    { 
      icon: Zap, 
      title: isAl ? 'Inspeksion Vizual' : 'Visual Inspections', 
      desc: isAl ? 'Vizatoni dëmtimet direkt mbi diagramin e makinës në tabletë para klientit.' : 'Draw damages directly on the car diagram using your tablet right in front of the client.' 
    },
    { 
      icon: BarChart3, 
      title: isAl ? 'Inventar Inteligjent' : 'Smart Inventory Management', 
      desc: isAl ? 'Ndiqni pjesët e këmbimit, merrni njoftime kur mbarojnë dhe menaxhoni furnitorët.' : 'Track spare parts, get low-stock alerts, and manage your suppliers easily.' 
    },
  ];

  // TE DHENAT E GALERISE (FOTOT DHE TEKSTET)
  const appShowcase = [
    {
      img: '/dashbordi.jpg',
      titleAL: 'Paneli Kryesor (Dashboard)', titleEN: 'Main Dashboard',
      descAL: 'Pasqyrë në kohë reale e operacioneve të biznesit tuaj. Ndiqni të ardhurat dhe punët aktive me një shikim.',
      descEN: 'Real-time overview of your business operations. Track income and active jobs at a glance.'
    },
    {
      img: '/kilentet.jpg',
      titleAL: 'Menaxhimi i Klientëve', titleEN: 'Client Management',
      descAL: 'Databazë e organizuar për çdo klient, detajet e kontaktit dhe historikun e tyre në garazhin tuaj.',
      descEN: 'Organized database for every client, their contact details, and their history at your garage.'
    },
    {
      img: '/veturat.jpg',
      titleAL: 'Regjistri i Veturave & Dekodimi i VIN', titleEN: 'Vehicle Registry & VIN Decoding',
      descAL: 'Regjistroni veturat shpejt duke përdorur numrin e shasisë (VIN) dhe ruani të dhënat teknike të tyre.',
      descEN: 'Register cars quickly using the chassis number (VIN) and store all their technical details.'
    },
    {
      img: '/Sherbimet.jpg',
      titleAL: 'Fletët e Punës (Shërbimet)', titleEN: 'Work Orders (Services)',
      descAL: 'Menaxhoni punët, riparimet aktuale dhe statusin e tyre nga "Në Pritje" deri te "E Përfunduar".',
      descEN: 'Manage ongoing jobs, repairs, and their statuses from "Pending" to "Completed".'
    },
    {
      img: '/inventari.jpg',
      titleAL: 'Menaxhimi i Inventarit', titleEN: 'Inventory Management',
      descAL: 'Ndiqni stokun e pjesëve, mbani shënim kostot e blerjes dhe llogarisni automatikisht marzhet e fitimit.',
      descEN: 'Track parts stock, record purchase costs, and automatically calculate your profit margins.'
    },
    {
      img: '/takimet.jpg',
      titleAL: 'Kalendari i Takimeve', titleEN: 'Appointments Calendar',
      descAL: 'Planifikoni dhe menaxhoni vizitat e ardhshme në garazh me një kalendar të thjeshtë dhe intuitiv.',
      descEN: 'Schedule and manage upcoming garage visits with a simple and intuitive calendar.'
    },
    {
      img: '/shpenzimet.jpg',
      titleAL: 'Shpenzimet e Biznesit', titleEN: 'Business Expenses',
      descAL: 'Gjurmoni shpenzimet e përgjithshme ditore si energjia elektrike, qiraja apo mjetet e punës.',
      descEN: 'Track your general daily expenses such as electricity, rent, or workshop tools.'
    },
    {
      img: '/raportet.jpg',
      titleAL: 'Raportet Financiare', titleEN: 'Financial Reports',
      descAL: 'Analizë e detajuar e të ardhurave dhe shpenzimeve me grafikë të qartë mujorë dhe vjetorë.',
      descEN: 'Detailed analysis of income and expenses with clear monthly and yearly graphical charts.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden font-sans selection:bg-blue-500 selection:text-white">
      
      {/* NAVBAR */}
      <motion.nav 
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="bg-white/90 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/applogo.png" alt="GarageData Logo" className="h-20 w-30 object-contain" onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md hidden">
              <Wrench size={20} strokeWidth={3} />
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-8 font-semibold text-gray-600">
            {navLinks.map(item => (
              <motion.a key={item.id} href={`#${item.id}`} whileHover={{ color: '#2563EB', y: -2 }} className="transition-colors">
                {isAl ? item.al : item.en}
              </motion.a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <motion.button 
              onClick={toggleLanguage}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-full font-bold transition-colors text-sm border border-gray-200"
            >
              <Globe size={16} className="text-blue-600" />
              <span>{isAl ? 'AL' : 'EN'}</span>
            </motion.button>

            <motion.button 
              onClick={onLoginClick}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              className="bg-gray-900 text-white px-6 py-2.5 rounded-full font-bold shadow-md hover:bg-black transition-colors text-sm"
            >
              {isAl ? 'Hyr / Regjistrohu' : 'Login / Register'}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* HERO SECTION */}
      <section className="relative pt-20 pb-28 bg-white overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full font-semibold text-sm mb-6 border border-blue-100 shadow-inner">
              <Zap size={16} className="text-blue-500 animate-pulse" /> 
              {isAl ? 'Platforma Inteligjente për Ofiçina' : 'Smart Platform for Auto Shops'}
            </motion.div>
            <motion.h1 variants={fadeInUp} className="text-5xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tighter mb-6">
              {isAl ? 'Kthejeni Ofiçinën tuaj në një' : 'Turn Your Workshop into a'} <span className="text-blue-600 relative">{isAl ? 'Makineri Fitimi' : 'Profit Machine'}<motion.span animate={{ width: ['0%', '100%'] }} transition={{ duration: 1, delay: 1 }} className="absolute bottom-1 left-0 h-1.5 bg-blue-200 rounded-full -z-10"></motion.span></span>.
            </motion.h1>
            <motion.p variants={fadeInUp} className="text-xl text-gray-600 mb-10 max-w-xl leading-relaxed">
              {isAl ? 'Softueri gjithë-përfshirës që automatizon punën, rrit precizionin dhe kënaq klientët - madje edhe pa internet.' : 'The all-in-one software that automates workflow, increases precision, and satisfies clients - even without internet.'}
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
              <motion.a href="#contact" whileHover={{ y: -4, boxShadow: "0 10px 20px rgba(37, 99, 235, 0.3)" }} className="bg-blue-600 text-white px-10 py-4 rounded-xl font-black text-lg shadow-lg flex items-center justify-center gap-3 transition-all">
                {isAl ? 'Kërko një Ofertë' : 'Get a Custom Offer'} <ArrowRight size={20} />
              </motion.a>
              <motion.a href="#gallery" whileHover={{ backgroundColor: "#F3F4F6" }} className="bg-transparent text-gray-800 px-10 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 border border-gray-200 transition-colors">
                <Play size={20} className="text-blue-600" /> {isAl ? 'Shiko Aplikacionin' : 'View App Gallery'}
              </motion.a>
            </motion.div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 100, rotate: 5 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }} className="relative">
             <img src="/dashbordi.jpg" alt="GarageData Dashboard Preview" className="w-full h-auto drop-shadow-2xl" />
          </motion.div>
        </div>
      </section>

      {/* GALLERY SECTION (Fotot & Përshkrimet) */}
      <section id="gallery" className="py-24 bg-gray-100 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={fadeInUp} className="text-center mb-20 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter mb-5">
              {isAl ? 'Një vështrim brenda platformës' : 'Take a look inside the platform'}
            </h2>
            <p className="text-lg text-gray-600">
              {isAl ? 'Ndërfaqe e pastër, e shpejtë dhe e krijuar specifikisht për t\'u përdorur pa mundim nga çdo mekanik.' : 'Clean, fast, and specifically designed to be used effortlessly by every mechanic.'}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-20">
            {appShowcase.map((item, index) => (
              <motion.div 
                key={index} 
                initial={{ opacity: 0, y: 50 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true, amount: 0.1 }} 
                transition={{ duration: 0.6, delay: (index % 2) * 0.1 }}
                className="flex flex-col group"
              >
                <div className="relative overflow-hidden rounded-[2rem] bg-white border border-gray-100 shadow-lg mb-6 transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-2xl">
                  <img src={item.img} alt={isAl ? item.titleAL : item.titleEN} className="w-full h-auto object-contain p-4" loading="lazy" />
                </div>
                <div className="px-2">
                  <h3 className="text-2xl font-black text-gray-900 mb-3">{isAl ? item.titleAL : item.titleEN}</h3>
                  <p className="text-gray-600 leading-relaxed">{isAl ? item.descAL : item.descEN}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={fadeInUp} className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tighter mb-5">{isAl ? 'Pse të zgjidhni GarageData?' : 'Why choose GarageData?'}</h2>
            <p className="text-lg text-gray-600 leading-relaxed">{isAl ? 'Ndërtuar për t\'i rezistuar kushteve reale të punës, pa ngadalësime dhe i aksesueshëm kudo.' : 'Built to withstand real working conditions, with no slowdowns, and accessible anywhere.'}</p>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <motion.div key={idx} variants={fadeInUp} whileHover={{ scale: 1.05 }} className="bg-gray-50 p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all group">
                <div className="bg-blue-100 text-blue-600 p-4 rounded-xl inline-block mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-200">
                  <feature.icon size={28} strokeWidth={2.5} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CONTACT FOR OFFER */}
      <section id="contact" className="py-32 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-50 rounded-l-full blur-3xl opacity-50 -z-10"></div>
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-green-50 rounded-r-full blur-3xl opacity-50 -z-10"></div>

        <div className="max-w-5xl mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="bg-gray-900 text-white rounded-[3rem] p-10 md:p-16 shadow-2xl relative overflow-hidden"
          >
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="bg-blue-500/20 text-blue-400 p-4 rounded-full inline-block mb-6">
                <PhoneCall size={48} />
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-6">
                {isAl ? 'Kërkoni Ofertën Tuaj të Personalizuar' : 'Get Your Custom Offer'}
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl leading-relaxed">
                {isAl ? 'Çdo ofiçinë është e ndryshme. Na telefononi ose na shkruani në WhatsApp për të diskutuar rreth nevojave tuaja dhe për të marrë çmimin më të mirë në treg.' : 'Every workshop is different. Call us or text us on WhatsApp to discuss your needs and get the best price on the market.'}
              </p>
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-6 w-full md:w-auto">
                <a href="tel:+38348323740" className="flex items-center gap-3 text-3xl font-black text-white hover:text-blue-400 transition-colors bg-gray-800 px-8 py-4 rounded-2xl w-full sm:w-auto justify-center">
                  +383 48323740
                </a>
                <a href="https://wa.me/38348323740" target="_blank" rel="noreferrer" className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-lg shadow-green-500/30 transition-transform hover:scale-105 w-full sm:w-auto">
                  <MessageSquare size={24} /> WhatsApp
                </a>
              </div>
            </div>
            
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-600 rounded-full blur-[80px] opacity-40"></div>
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-green-500 rounded-full blur-[80px] opacity-20"></div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 bg-white border-t border-gray-100 text-center text-gray-500 text-sm">
        <p className="font-bold text-gray-800 mb-1">GarageData © {new Date().getFullYear()}</p>
        <p>{isAl ? 'Të gjitha të drejtat e rezervuara.' : 'All rights reserved.'}</p>
      </footer>
    </div>
  );
}