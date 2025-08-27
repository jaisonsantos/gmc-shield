import React, { useState, useEffect } from 'react';
import { Shield, BarChart, FileText, CheckCircle, BellRing, DollarSign, Users, ArrowRight, X, Menu, Loader2, Globe } from 'lucide-react';

// Language content dictionary
const translations = {
  'pt-BR': {
      nav: {
        home: 'Início',
        howItWorks: 'Como Funciona',
        features: 'Funcionalidades',
        pricing: 'Preços',
        contact: 'Contato',
        login: 'Entrar',
      },
    hero: {
      headline: 'Nunca mais tenha seu produto bloqueado no Google Shopping.',
      subheadline: 'O GMC Shield é a sua proteção definitiva contra suspensões e reprovações no Google Merchant Center. Mantenha seus anúncios no ar e suas vendas crescendo.',
      tryFree: 'Experimente Grátis',
      learnMore: 'Saiba Mais',
    },
    howItWorks: {
      title: 'Como o GMC Shield funciona?',
      step1Title: '1. Escaneie seu Feed',
      step1Desc: 'Importamos seu feed de produtos ou conectamos diretamente ao seu WooCommerce para uma análise completa.',
      step2Title: '2. Detecte Violações',
      step2Desc: 'Nosso crawler simula o Googlebot, identificando discrepâncias entre seu feed e sua página.',
      step3Title: '3. Previna Bloqueios',
      step3Desc: 'Bloqueie itens de risco preventivamente antes que causem suspensões na sua conta.',
      step4Title: '4. Gere Apelações',
      step4Desc: 'Crie pacotes de apelação completos com evidências para reativar sua conta rapidamente.',
    },
    features: {
      title: 'Recursos Poderosos para Sua Loja',
      feature1Title: 'Motor de Regras Inteligente',
      feature1Desc: 'Detecta discrepâncias de preço, moeda, disponibilidade, redirecionamentos e mais, com evidências visuais.',
      feature2Title: 'Kit de Apelação Automatizado',
      feature2Desc: 'Gere PDFs com evidências de correção, arquivos ZIP e textos pré-escritos para acelerar a reativação da conta.',
      feature3Title: 'Bloqueio Preventivo de Itens',
      feature3Desc: 'Marque produtos de risco para serem excluídos do feed do Google, protegendo sua conta de suspensões.',
      feature4Title: 'Gerador de Políticas Legais',
      feature4Desc: 'Crie e publique automaticamente páginas de políticas essenciais (envio, devolução, contato) diretamente no seu WordPress.',
      feature5Title: 'Alertas e Notificações Diárias',
      feature5Desc: 'Receba alertas em tempo real por e-mail ou Slack sobre novas violações e riscos iminentes.',
      feature6Title: 'Gestão para Agências',
      feature6Desc: 'Gerencie múltiplas lojas de clientes em uma única plataforma, com controle de acesso por papel (RBAC).',
    },
    pricing: {
      title: 'Planos que se encaixam na sua necessidade',
      subheadline: 'Escolha o plano ideal para proteger sua loja e garantir que seus produtos estejam sempre visíveis no Google. Todos os planos incluem um teste gratuito de 14 dias!',
      soloTitle: 'Solo',
      soloPrice: '$19',
      soloPerks: [
        "Até 500 produtos",
        "Análise de Preço/Disponibilidade",
        "Bloqueio Manual de Itens",
        "Suporte por E-mail",
      ],
      proTitle: 'Pro',
      proPrice: '$49',
      proPerks: [
        "Até 5.000 produtos",
        "Todas as Regras de Violação",
        "Kit de Apelação Automatizado",
        "Gerador de Políticas Legais",
        "Notificações Diárias (E-mail/Slack)",
        "Suporte Prioritário",
      ],
      agencyTitle: 'Agência',
      agencyPrice: '$99+',
      agencyPerks: [
        "Até 10 lojas (SKUs ilimitados)",
        "Todos os recursos Pro",
        "Gestão Multi-Lojas",
        "Acesso para Sub-Usuários (RBAC)",
        "Suporte Dedicado",
      ],
      perMonth: '/mês',
      startFreeTrial: 'Começar Teste Grátis',
      choosePlan: 'Escolher Plano',
    },
    callToAction: {
      title: 'Pronto para proteger sua loja?',
      subheadline: 'Junte-se a e-commerces e agências que confiam no GMC Shield para manter seus produtos no Google Shopping e suas vendas em alta.',
      formTitle: 'Comece seu Teste Grátis Hoje!',
      emailLabel: 'E-mail',
      passwordLabel: 'Senha',
      createAccount: 'Criar minha conta',
      registering: 'Cadastrando...',
      successMessage: 'Cadastro realizado com sucesso! Verifique seu e-mail para ativar sua conta.',
      errorMessage: 'Erro ao cadastrar: ',
      connectionError: 'Erro de conexão. Tente novamente mais tarde.',
    },
    footer: {
      copyright: 'Todos os direitos reservados.',
      terms: 'Termos de Serviço',
      privacy: 'Política de Privacidade',
      contact: 'Contato',
    },
  },
  'pt-PT': {
      nav: {
        home: 'Início',
        howItWorks: 'Como Funciona',
        features: 'Funcionalidades',
        pricing: 'Preços',
        contact: 'Contacto',
        login: 'Entrar',
      },
    hero: {
      headline: 'Nunca mais tenha o seu produto bloqueado no Google Shopping.',
      subheadline: 'O GMC Shield é a sua proteção definitiva contra suspensões e reprovações no Google Merchant Center. Mantenha os seus anúncios ativos e as suas vendas a crescer.',
      tryFree: 'Experimente Grátis',
      learnMore: 'Saiba Mais',
    },
    howItWorks: {
      title: 'Como o GMC Shield funciona?',
      step1Title: '1. Analise o seu Feed',
      step1Desc: 'Importamos o seu feed de produtos ou ligamos diretamente ao seu WooCommerce para uma análise completa.',
      step2Title: '2. Detete Violações',
      step2Desc: 'O nosso crawler simula o Googlebot, identificando discrepâncias entre o seu feed e a sua página.',
      step3Title: '3. Previna Bloqueios',
      step3Desc: 'Bloqueie itens de risco preventivamente antes que causem suspensões na sua conta.',
      step4Title: '4. Gere Apelações',
      step4Desc: 'Crie pacotes de apelação completos com provas para reativar a sua conta rapidamente.',
    },
    features: {
      title: 'Funcionalidades Poderosas para a Sua Loja',
      feature1Title: 'Motor de Regras Inteligente',
      feature1Desc: 'Deteta discrepâncias de preço, moeda, disponibilidade, redirecionamentos e mais, com provas visuais.',
      feature2Title: 'Kit de Apelação Automatizado',
      feature2Desc: 'Gere PDFs com provas de correção, arquivos ZIP e textos pré-escritos para acelerar a reativação da conta.',
      feature3Title: 'Bloqueio Preventivo de Itens',
      feature3Desc: 'Marque produtos de risco para serem excluídos do feed do Google, protegendo a sua conta de suspensões.',
      feature4Title: 'Gerador de Políticas Legais',
      feature4Desc: 'Crie e publique automaticamente páginas de políticas essenciais (envio, devolução, contacto) diretamente no seu WordPress.',
      feature5Title: 'Alertas e Notificações Diárias',
      feature5Desc: 'Receba alertas em tempo real por e-mail ou Slack sobre novas violações e riscos iminentes.',
      feature6Title: 'Gestão para Agências',
      feature6Desc: 'Gira múltiplas lojas de clientes numa única plataforma, com controlo de acesso por função (RBAC).',
    },
    pricing: {
      title: 'Planos que se adequam à sua necessidade',
      subheadline: 'Escolha o plano ideal para proteger a sua loja e garantir que os seus produtos estão sempre visíveis no Google. Todos os planos incluem um teste gratuito de 14 dias!',
      soloTitle: 'Solo',
      soloPrice: '$19',
      soloPerks: [
        "Até 500 produtos",
        "Análise de Preço/Disponibilidade",
        "Bloqueio Manual de Itens",
        "Suporte por Email",
      ],
      proTitle: 'Pro',
      proPrice: '$49',
      proPerks: [
        "Até 5.000 produtos",
        "Todas as Regras de Violação",
        "Kit de Apelação Automatizado",
        "Gerador de Políticas Legais",
        "Notificações Diárias (Email/Slack)",
        "Suporte Prioritário",
      ],
      agencyTitle: 'Agência',
      agencyPrice: '$99+',
      agencyPerks: [
        "Até 10 lojas (SKUs ilimitados)",
        "Todos os recursos Pro",
        "Gestão Multi-Lojas",
        "Acesso para Sub-Utilizadores (RBAC)",
        "Suporte Dedicado",
      ],
      perMonth: '/mês',
      startFreeTrial: 'Começar Teste Grátis',
      choosePlan: 'Escolher Plano',
    },
    callToAction: {
      title: 'Pronto para proteger a sua loja?',
      subheadline: 'Junte-se a e-commerces e agências que confiam no GMC Shield para manter os seus produtos no Google Shopping e as suas vendas em alta.',
      formTitle: 'Comece o seu Teste Grátis Hoje!',
      emailLabel: 'Email',
      passwordLabel: 'Palavra-passe',
      createAccount: 'Criar a minha conta',
      registering: 'A registar...',
      successMessage: 'Registo realizado com sucesso! Verifique o seu email para ativar a sua conta.',
      errorMessage: 'Erro ao registar: ',
      connectionError: 'Erro de conexão. Tente novamente mais tarde.',
    },
    footer: {
      copyright: 'Todos os direitos reservados.',
      terms: 'Termos de Serviço',
      privacy: 'Política de Privacidade',
      contact: 'Contacto',
    },
  },
  'es': {
      nav: {
        home: 'Inicio',
        howItWorks: 'Cómo Funciona',
        features: 'Características',
        pricing: 'Precios',
        contact: 'Contacto',
        login: 'Iniciar Sesión',
      },
    hero: {
      headline: 'Nunca más tengas tu producto bloqueado en Google Shopping.',
      subheadline: 'GMC Shield es tu protección definitiva contra suspensiones y desaprobaciones en Google Merchant Center. Mantén tus anuncios en línea y tus ventas creciendo.',
      tryFree: 'Prueba Gratis',
      learnMore: 'Saber Más',
    },
    howItWorks: {
      title: '¿Cómo funciona GMC Shield?',
      step1Title: '1. Escanea tu Feed',
      step1Desc: 'Importamos tu feed de productos o nos conectamos directamente a tu WooCommerce para un análisis completo.',
      step2Title: '2. Detecta Infracciones',
      step2Desc: 'Nuestro rastreador simula Googlebot, identificando discrepancias entre tu feed y tu página.',
      step3Title: '3. Previene Bloqueos',
      step3Desc: 'Bloquea elementos de riesgo preventivamente antes de que causen suspensiones en tu cuenta.',
      step4Title: '4. Genera Apelaciones',
      step4Desc: 'Crea paquetes de apelación completos con evidencia para reactivar tu cuenta rápidamente.',
    },
    features: {
      title: 'Funciones Potentes para Tu Tienda',
      feature1Title: 'Motor de Reglas Inteligente',
      feature1Desc: 'Detecta discrepancias de precio, moneda, disponibilidad, redirecciones y más, con evidencia visual.',
      feature2Title: 'Kit de Apelación Automatizado',
      feature2Desc: 'Genera PDFs con evidencia de corrección, archivos ZIP y textos preescritos para acelerar la reactivación de la cuenta.',
      feature3Title: 'Bloqueo Preventivo de Artículos',
      feature3Desc: 'Marca productos de riesgo para ser excluidos del feed de Google, protegiendo tu cuenta de suspensiones.',
      feature4Title: 'Generador de Políticas Legales',
      feature4Desc: 'Crea y publica automáticamente páginas de políticas esenciales (envío, devolución, contacto) directamente en tu WordPress.',
      feature5Title: 'Alertas y Notificaciones Diarias',
      feature5Desc: 'Recibe alertas en tiempo real por correo electrónico o Slack sobre nuevas infracciones y riesgos inminentes.',
      feature6Title: 'Gestión para Agencias',
      feature6Desc: 'Administra múltiples tiendas de clientes en una única plataforma, con control de acceso basado en roles (RBAC).',
    },
    pricing: {
      title: 'Planes que se ajustan a tu necesidad',
      subheadline: 'Elige el plan ideal para proteger tu tienda y asegurarte de que tus productos estén siempre visibles en Google. ¡Todos los planes incluyen una prueba gratuita de 14 días!',
      soloTitle: 'Solo',
      soloPrice: '$19',
      soloPerks: [
        "Hasta 500 productos",
        "Análisis de Precio/Disponibilidad",
        "Bloqueo Manual de Artículos",
        "Soporte por Correo Electrónico",
      ],
      proTitle: 'Pro',
      proPrice: '$49',
      proPerks: [
        "Hasta 5.000 productos",
        "Todas las Reglas de Infracción",
        "Kit de Apelación Automatizado",
        "Generador de Políticas Legales",
        "Notificaciones Diarias (Correo/Slack)",
        "Soporte Prioritario",
      ],
      agencyTitle: 'Agencia',
      agencyPrice: '$99+',
      agencyPerks: [
        "Hasta 10 tiendas (SKUs ilimitados)",
        "Todos los recursos Pro",
        "Gestión Multi-Tiendas",
        "Acceso para Sub-Usuarios (RBAC)",
        "Soporte Dedicado",
      ],
      perMonth: '/mes',
      startFreeTrial: 'Comenzar Prueba Gratis',
      choosePlan: 'Elegir Plan',
    },
    callToAction: {
      title: '¿Listo para proteger tu tienda?',
      subheadline: 'Únete a e-commerces y agencias que confían en GMC Shield para mantener sus productos en Google Shopping y sus ventas en aumento.',
      formTitle: '¡Comienza tu Prueba Gratis Hoy!',
      emailLabel: 'Correo Electrónico',
      passwordLabel: 'Contraseña',
      createAccount: 'Crear mi cuenta',
      registering: 'Registrando...',
      successMessage: '¡Registro exitoso! Revisa tu correo electrónico para activar tu cuenta.',
      errorMessage: 'Error al registrar: ',
      connectionError: 'Error de conexión. Inténtalo de nuevo más tarde.',
    },
    footer: {
      copyright: 'Todos los derechos reservados.',
      terms: 'Términos de Servicio',
      privacy: 'Política de Privacidad',
      contact: 'Contacto',
    },
  },
  'en': {
      nav: {
        home: 'Home',
        howItWorks: 'How It Works',
        features: 'Features',
        pricing: 'Pricing',
        contact: 'Contact',
        login: 'Login',
      },
    hero: {
      headline: 'Never get your product blocked on Google Shopping again.',
      subheadline: 'GMC Shield is your definitive protection against suspensions and disapprovals in Google Merchant Center. Keep your ads live and your sales growing.',
      tryFree: 'Try for Free',
      learnMore: 'Learn More',
    },
    howItWorks: {
      title: 'How does GMC Shield work?',
      step1Title: '1. Scan your Feed',
      step1Desc: 'We import your product feed or connect directly to your WooCommerce for a complete analysis.',
      step2Title: '2. Detect Violations',
      step2Desc: 'Our crawler simulates Googlebot, identifying discrepancies between your feed and your page.',
      step3Title: '3. Prevent Blocks',
      step3Desc: 'Block risky items preventively before they cause suspensions in your account.',
      step4Title: '4. Generate Appeals',
      step4Desc: 'Create complete appeal packages with evidence to reactivate your account quickly.',
    },
    pricing: {
      title: 'Plans that fit your needs',
      subheadline: 'Choose the ideal plan to protect your store and ensure your products are always visible on Google. All plans include a 14-day free trial!',
      soloTitle: 'Solo',
      soloPrice: '$19',
      soloPerks: [
        "Up to 500 products",
        "Price/Availability Analysis",
        "Manual Item Blocking",
        "Email Support",
      ],
      proTitle: 'Pro',
      proPrice: '$49',
      proPerks: [
        "Up to 5,000 products",
        "All Violation Rules",
        "Automated Appeal Kit",
        "Legal Policy Generator",
        "Daily Notifications (Email/Slack)",
        "Priority Support",
      ],
      agencyTitle: 'Agency',
      agencyPrice: '$99+',
      agencyPerks: [
        "Up to 10 stores (unlimited SKUs)",
        "All Pro features",
        "Multi-Store Management",
        "Sub-User Access (RBAC)",
        "Dedicated Support",
      ],
      perMonth: '/month',
      startFreeTrial: 'Start Free Trial',
      choosePlan: 'Choose Plan',
    },
    callToAction: {
      title: 'Ready to protect your store?',
      subheadline: 'Join e-commerce businesses and agencies that trust GMC Shield to keep their products on Google Shopping and their sales high.',
      formTitle: 'Start your Free Trial Today!',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      createAccount: 'Create my account',
      registering: 'Registering...',
      successMessage: 'Registration successful! Check your email to activate your account.',
      errorMessage: 'Registration error: ',
      connectionError: 'Connection error. Please try again later.',
    },
    footer: {
      copyright: 'All rights reserved.',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      contact: 'Contact',
    },
    features: {
      title: 'Powerful Features for Your Store',
      feature1Title: 'Smart Rule Engine',
      feature1Desc: 'Detects discrepancies in price, currency, availability, redirects, and more, with visual evidence.',
      feature2Title: 'Automated Appeal Kit',
      feature2Desc: 'Generate PDFs with correction evidence, ZIP files, and pre-written texts to accelerate account reactivation.',
      feature3Title: 'Preventive Item Blocking',
      feature3Desc: 'Mark risky products to be excluded from the Google feed, protecting your account from suspensions.',
      feature4Title: 'Legal Policy Generator',
      feature4Desc: 'Automatically create and publish essential policy pages (shipping, returns, contact) directly on your WordPress.',
      feature5Title: 'Daily Alerts & Notifications',
      feature5Desc: 'Receive real-time alerts via email or Slack about new violations and imminent risks.',
      feature6Title: 'Agency Management',
      feature6Desc: 'Manage multiple client stores on a single platform, with role-based access control (RBAC).',
    },
  },
};

// Main App Component
function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [language, setLanguage] = useState('pt-BR'); // Default language

  const text = translations[language]; // Get texts for the current language

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  return (
        <div className="antialiased text-gray-800 bg-gray-50">
      {/* Header */}
      <header className="relative bg-white shadow-sm py-4 px-6 md:px-12 z-50">
        <nav className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-purple-600" />
            <span className="text-2xl font-bold text-gray-900">GMC Shield</span>
          </div>

          {/* Desktop Navigation */}
          <ul className="hidden md:flex space-x-8 items-center">
            <li><a href="#hero" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">{text.nav.home}</a></li>
            <li><a href="#how-it-works" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">{text.nav.howItWorks}</a></li>
            <li><a href="#features" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">{text.nav.features}</a></li>
            <li><a href="#pricing" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">{text.nav.pricing}</a></li>
            <li><a href="#contact" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">{text.nav.contact}</a></li>
            <li><a href="/login" className="text-gray-600 hover:text-purple-600 font-medium transition-colors">{text.nav.login}</a></li>
            <li className="ml-4">
              <div className="relative inline-flex items-center group">
                <Globe className="h-5 w-5 text-gray-600 mr-1" />
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="bg-transparent text-gray-600 font-medium cursor-pointer appearance-none outline-none focus:outline-none focus:ring-0 pl-1 pr-6" // Added pl-1 pr-6
                >
                  <option value="pt-BR">Português (Brasil)</option>
                  <option value="pt-PT">Português (Portugal)</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
                {/* Custom arrow for desktop (if needed for consistency, hidden by default with appearance-none) */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15 9.707V15H5v-5.293l5.293 5.293z"/></svg>
                </div>
              </div>
            </li>
          </ul>

          {/* Mobile Menu Button and Language Selector */}
          <div className="flex items-center md:hidden">
            <div className="relative inline-flex items-center group mr-4">
                <Globe className="h-5 w-5 text-gray-600 mr-1" />
                <select
                  value={language}
                  onChange={handleLanguageChange}
                  className="bg-transparent text-gray-600 font-medium cursor-pointer appearance-none outline-none focus:outline-none focus:ring-0 pl-1 pr-6" // Added pl-1 pr-6
                  style={{ width: 'auto' }} 
                >
                  {/* Changed values for better mobile display */}
                  <option value="pt-BR">PT-BR</option>
                  <option value="pt-PT">PT-PT</option>
                  <option value="es">ES</option>
                  <option value="en">EN</option>
                </select>
                {/* Custom arrow for mobile */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15 9.707V15H5v-5.293l5.293 5.293z"/></svg>
                </div>
            </div>
            <button className="p-2 rounded-md hover:bg-gray-100 transition-colors" onClick={toggleMobileMenu}>
              {isMobileMenuOpen ? <X className="h-6 w-6 text-gray-600" /> : <Menu className="h-6 w-6 text-gray-600" />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-white bg-opacity-95 z-40 flex flex-col items-center justify-center space-y-8">
            <ul className="flex flex-col space-y-8 text-center">
              <li><a href="#hero" className="text-gray-800 text-3xl font-semibold hover:text-purple-600 transition-colors" onClick={toggleMobileMenu}>{text.nav.home}</a></li>
              <li><a href="#how-it-works" className="text-gray-800 text-3xl font-semibold hover:text-purple-600 transition-colors" onClick={toggleMobileMenu}>{text.nav.howItWorks}</a></li>
              <li><a href="#features" className="text-gray-800 text-3xl font-semibold hover:text-purple-600 transition-colors" onClick={toggleMobileMenu}>{text.nav.features}</a></li>
              <li><a href="#pricing" className="text-gray-800 text-3xl font-semibold hover:text-purple-600 transition-colors" onClick={toggleMobileMenu}>{text.nav.pricing}</a></li>
              <li><a href="#contact" className="text-gray-800 text-3xl font-semibold hover:text-purple-600 transition-colors" onClick={toggleMobileMenu}>{text.nav.contact}</a></li>
              <li><a href="/login" className="text-gray-800 text-3xl font-semibold hover:text-purple-600 transition-colors" onClick={toggleMobileMenu}>{text.nav.login}</a></li>
            </ul>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section id="hero" className="relative bg-gradient-to-br from-purple-500 to-indigo-600 text-white py-20 md:py-32 overflow-hidden rounded-bl-3xl rounded-br-3xl shadow-lg">
          <div className="container mx-auto px-6 md:px-12 text-center relative z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-in-up">
              {text.hero.headline}
            </h1>
            <p className="text-lg md:text-xl mb-10 opacity-90 animate-fade-in-up delay-200">
              {text.hero.subheadline}
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6 animate-fade-in-up delay-400">
              <a href="#pricing" className="inline-flex items-center justify-center px-8 py-4 bg-white text-purple-700 font-bold rounded-full shadow-lg hover:bg-gray-100 transition-transform transform hover:scale-105">
                {text.hero.tryFree}
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
              <a href="#features" className="inline-flex items-center justify-center px-8 py-4 border-2 border-white text-white font-bold rounded-full hover:bg-white hover:text-purple-700 transition-colors">
                {text.hero.learnMore}
              </a>
            </div>
          </div>
          {/* Subtle background pattern/gradient for innovation */}
          <div className="absolute inset-0 z-0 opacity-10">
            <div className="absolute w-96 h-96 bg-purple-400 rounded-full blur-3xl -top-20 -left-20 animate-pulse-slow"></div>
            <div className="absolute w-80 h-80 bg-indigo-400 rounded-full blur-3xl -bottom-10 -right-10 animate-pulse-slow delay-500"></div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 md:py-28 bg-gray-50">
          <div className="container mx-auto px-6 md:px-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">{text.howItWorks.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="bg-white p-8 rounded-xl shadow-md transform hover:scale-105 transition-transform duration-300">
                <Shield className="h-12 w-12 text-purple-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-4 text-gray-800">{text.howItWorks.step1Title}</h3>
                <p className="text-gray-600">{text.howItWorks.step1Desc}</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-md transform hover:scale-105 transition-transform duration-300 delay-100">
                <BarChart className="h-12 w-12 text-green-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-4 text-gray-800">{text.howItWorks.step2Title}</h3>
                <p className="text-gray-600">{text.howItWorks.step2Desc}</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-md transform hover:scale-105 transition-transform duration-300 delay-200">
                <CheckCircle className="h-12 w-12 text-blue-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-4 text-gray-800">{text.howItWorks.step3Title}</h3>
                <p className="text-gray-600">{text.howItWorks.step3Desc}</p>
              </div>
              <div className="bg-white p-8 rounded-xl shadow-md transform hover:scale-105 transition-transform duration-300 delay-300">
                <FileText className="h-12 w-12 text-red-600 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-4 text-gray-800">{text.howItWorks.step4Title}</h3>
                <p className="text-gray-600">{text.howItWorks.step4Desc}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 md:py-28 bg-white">
          <div className="container mx-auto px-6 md:px-12">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900">{text.features.title}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
              <FeatureCard 
                icon={<BarChart className="h-10 w-10 text-purple-600" />}
                title={text.features.feature1Title}
                description={text.features.feature1Desc}
              />
              <FeatureCard 
                icon={<FileText className="h-10 w-10 text-green-600" />}
                title={text.features.feature2Title}
                description={text.features.feature2Desc}
              />
              <FeatureCard 
                icon={<Shield className="h-10 w-10 text-blue-600" />}
                title={text.features.feature3Title}
                description={text.features.feature3Desc}
              />
              <FeatureCard 
                icon={<FileText className="h-10 w-10 text-orange-600" />}
                title={text.features.feature4Title}
                description={text.features.feature4Desc}
              />
              <FeatureCard 
                icon={<BellRing className="h-10 w-10 text-red-600" />}
                title={text.features.feature5Title}
                description={text.features.feature5Desc}
              />
              <FeatureCard 
                icon={<Users className="h-10 w-10 text-indigo-600" />}
                title={text.features.feature6Title}
                description={text.features.feature6Desc}
              />
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-20 md:py-28 bg-gray-50">
          <div className="container mx-auto px-6 md:px-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-gray-900">{text.pricing.title}</h2>
            <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
              {text.pricing.subheadline}
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <PricingCard
                title={text.pricing.soloTitle}
                price={text.pricing.soloPrice}
                perks={text.pricing.soloPerks}
                perMonth={text.pricing.perMonth}
                startFreeTrial={text.pricing.startFreeTrial}
                choosePlan={text.pricing.choosePlan}
                isFeatured={false}
              />
              <PricingCard
                title={text.pricing.proTitle}
                price={text.pricing.proPrice}
                perks={text.pricing.proPerks}
                perMonth={text.pricing.perMonth}
                startFreeTrial={text.pricing.startFreeTrial}
                choosePlan={text.pricing.choosePlan}
                isFeatured={true}
              />
              <PricingCard
                title={text.pricing.agencyTitle}
                price={text.pricing.agencyPrice}
                perks={text.pricing.agencyPerks}
                perMonth={text.pricing.perMonth}
                startFreeTrial={text.pricing.startFreeTrial}
                choosePlan={text.pricing.choosePlan}
                isFeatured={false}
              />
            </div>
          </div>
        </section>

        {/* Call to Action / Testimonial Placeholder */}
        <section id="contact" className="py-20 md:py-28 bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-tl-3xl rounded-tr-3xl shadow-lg">
          <div className="container mx-auto px-6 md:px-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">{text.callToAction.title}</h2>
            <p className="text-lg mb-10 opacity-90 max-w-3xl mx-auto">
              {text.callToAction.subheadline}
            </p>
            <SignupForm text={text.callToAction} />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-10 px-6 md:px-12">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-sm">
          <div className="mb-4 md:mb-0">
            <Shield className="inline-block h-6 w-6 text-purple-400 mr-2" />
            <span className="font-semibold">GMC Shield</span> &copy; {new Date().getFullYear()} {text.footer.copyright}.
          </div>
          <ul className="flex flex-wrap justify-center space-x-6">
            <li><a href="#" className="hover:text-white transition-colors">{text.footer.terms}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{text.footer.privacy}</a></li>
            <li><a href="#" className="hover:text-white transition-colors">{text.footer.contact}</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-white p-6 rounded-xl shadow-md text-center transform hover:scale-105 transition-transform duration-300">
    <div className="flex justify-center mb-4">{icon}</div>
    <h3 className="text-xl font-semibold mb-3 text-gray-800">{title}</h3>
    <p className="text-gray-600">{description}</p>
  </div>
);

// Pricing Card Component
const PricingCard = ({ title, price, perks, isFeatured, perMonth, startFreeTrial, choosePlan }) => (
  <div className={`bg-white p-8 rounded-xl shadow-lg ${isFeatured ? 'border-4 border-purple-500 transform scale-105' : 'border border-gray-200'} transition-transform duration-300`}>
    <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
    <div className="text-5xl font-extrabold text-purple-600 mb-6">
      {price}<span className="text-lg text-gray-500 font-medium">{perMonth}</span>
    </div>
    <ul className="text-gray-700 text-left mb-8 space-y-3">
      {perks.map((perk, index) => (
        <li key={index} className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
          <span>{perk}</span>
        </li>
      ))}
    </ul>
    <button className={`w-full px-6 py-3 rounded-full font-bold transition-colors ${isFeatured ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-purple-600 hover:bg-gray-200'}`}>
      {isFeatured ? startFreeTrial : choosePlan}
    </button>
  </div>
);

// Signup Form Component
const SignupForm = ({ text }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      // Placeholder for your API call
      // Replace with your actual backend API endpoint
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        setMessage(text.successMessage);
        setEmail('');
        setPassword('');
      } else {
        const errorData = await response.json();
        setMessage(`${text.errorMessage}${errorData.detail || 'Tente novamente.'}`);
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      setMessage(text.connectionError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg max-w-md mx-auto text-left">
      <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">{text.formTitle}</h3>
      <div className="mb-4">
        <label htmlFor="email" className="block text-gray-700 text-sm font-semibold mb-2">{text.emailLabel}</label>
        <input
          type="email"
          id="email"
          className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="seu@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="mb-6">
        <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">{text.passwordLabel}</label>
        <input
          type="password"
          id="password"
          className="shadow-sm appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-full hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75 transition-colors flex items-center justify-center"
        disabled={isLoading}
      >
        {isLoading ? <Loader2 className="animate-spin mr-2" /> : <ArrowRight className="mr-2" />}
        {isLoading ? text.registering : text.createAccount}
      </button>
      {message && (
        <p className={`mt-4 text-center ${message.includes(text.successMessage) ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
};

export default App;
