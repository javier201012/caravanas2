import { useEffect, useState } from 'react'
import './App.css'
import {
  BRAND_NAME,
  calculateFirstMonthCharge,
  formatCurrency,
  MONTHLY_RATE_CENTS,
} from '../booking.js'

const logoImage = '/logo.webp'

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4242'
    : '')

const mapsUrl =
  'https://www.google.es/maps/@40.2632148,-3.8341746,3a,75y,90h,90t/data=!3m7!1e1!3m5!1sMQ1JnwW6nLd95gtzeJ7c8w!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D0%26panoid%3DMQ1JnwW6nLd95gtzeJ7c8w%26yaw%3D90!7i16384!8i8192?entry=ttu&g_ep=EgoyMDI2MDMyMy4xIKXMDSoASAFQAw%3D%3D'

const gatePhotoUrl =
  'https://streetviewpixels-pa.googleapis.com/v1/thumbnail?cb_client=maps_sv.tactile&w=630&h=420&pitch=0&panoid=MQ1JnwW6nLd95gtzeJ7c8w&yaw=90'

const navItems = [
  { label: 'Ventajas', href: '#ventajas' },
  { label: 'Ubicación', href: '#ubicacion' },
  { label: 'Tarifa', href: '#tarifa' },
  { label: 'Proceso', href: '#proceso' },
  { label: 'Contacto', href: '#contacto' },
]

const featureCards = [
  {
    title: 'Aparcamiento preparado de verdad',
    text: 'Recinto hormigonado dentro de polígono industrial, pensado para entrar y salir con comodidad y sin maniobras tensas.',
  },
  {
    title: 'Primer pago prorrateado',
    text: 'El alta inicial se calcula a 2 euros al día según los días que falten hasta final de mes. Después la cuota vuelve a 60 euros.',
  },
  {
    title: 'Disponibilidad visible y editable',
    text: 'Las fechas de entrada salen del backend y puedes bloquear o liberar días desde un panel admin sencillo.',
  },
]

const quickFacts = [
  { value: '2 EUR/día', label: 'alta inicial hasta fin de mes' },
  { value: formatCurrency(MONTHLY_RATE_CENTS), label: 'renovación el primer día de cada mes' },
  { value: '90 días', label: 'ventana de fechas gestionable' },
]

const valueItems = [
  'Espacio hormigonado para un uso más cómodo y limpio.',
  'Entorno industrial con accesos pensados para vehículos de volumen.',
  'Primer cobro justo, sin obligar a pagar un mes entero si entras a mitad.',
  'Panel admin simple para bloquear días ocupados o reservar huecos manualmente.',
]

const processSteps = [
  {
    title: 'Elige la fecha de entrada',
    text: 'La web muestra solo días disponibles. Así el cliente no intenta pagar una fecha ya ocupada.',
  },
  {
    title: 'Se calcula el alta inicial',
    text: 'Stripe cobra el primer período a 2 euros por día hasta fin de mes y deja preparada la renovación automática.',
  },
  {
    title: 'Renovación mensual ordenada',
    text: 'Desde el mes siguiente la cuota se renueva el primer día de cada mes con la tarifa mensual habitual de 60 euros.',
  },
]

const faqItems = [
  {
    question: '¿Cómo funciona el primer pago?',
    answer: 'El primer cobro se calcula por días restantes del mes a 2 euros al día. Si entras el 20, solo pagas del 20 al final de ese mes.',
  },
  {
    question: '¿Cuándo se renueva después?',
    answer: 'La suscripción queda preparada para renovarse automáticamente el primer día de cada mes con la cuota mensual de 60 euros.',
  },
  {
    question: '¿Puedo cambiar las fechas disponibles yo mismo?',
    answer: 'Sí. La landing incluye un panel admin básico protegido por contraseña para bloquear o liberar días de entrada.',
  },
  {
    question: '¿Dónde está exactamente?',
    answer: 'En Calle Malva 4, Humanes, dentro de polígono industrial y muy cerca de Fuenlabrada y Moraleja de En Medio.',
  },
]

const emptyAvailability = {
  calendar: [],
  availableDates: [],
  unavailableDates: [],
  isFullyBooked: false,
  updatedAt: null,
}

function normalizeFullyBooked(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}

function normalizeAvailabilityResponse(data, fallback = emptyAvailability) {
  return {
    calendar: Array.isArray(data.calendar) ? data.calendar : [],
    availableDates: Array.isArray(data.availableDates) ? data.availableDates : [],
    unavailableDates: Array.isArray(data.unavailableDates) ? data.unavailableDates : [],
    isFullyBooked: normalizeFullyBooked(data.isFullyBooked, fallback.isFullyBooked),
    updatedAt: data.updatedAt || fallback.updatedAt || null,
  }
}

async function requestAvailability() {
  const response = await fetch(`${apiBaseUrl}/api/availability`)
  const responseText = await response.text()

  let data = {}

  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      throw new Error('La API de disponibilidad no ha devuelto JSON válido.')
    }
  }

  if (!response.ok) {
    throw new Error(data.error || 'No se pudo cargar la disponibilidad.')
  }

  return normalizeAvailabilityResponse(data)
}

function formatUpdatedAt(value) {
  if (!value) {
    return 'Sin cambios guardados todavía.'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return 'Sin cambios guardados todavía.'
  }

  return parsed.toLocaleString('es-ES')
}

function isCurrentMonthDate(dateIso, referenceDate = new Date()) {
  if (typeof dateIso !== 'string') {
    return false
  }

  const [year, month] = dateIso.split('-').map(Number)

  return year === referenceDate.getFullYear() && month === referenceDate.getMonth() + 1
}

function buildAdminCalendarMonths(calendarDates) {
  const monthMap = {}

  for (const date of calendarDates) {
    const [year, month] = date.iso.split('-').map(Number)
    const key = `${year}-${String(month).padStart(2, '0')}`

    if (!monthMap[key]) {
      monthMap[key] = { year, month, dates: {} }
    }

    monthMap[key].dates[date.iso] = date
  }

  return Object.values(monthMap).sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month,
  )
}

function App() {
  const [paymentError, setPaymentError] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')
  const [adminError, setAdminError] = useState('')
  const [adminSuccess, setAdminSuccess] = useState('')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(true)
  const [isRedirectingToCheckout, setIsRedirectingToCheckout] = useState(false)
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)
  const [isSavingAvailability, setIsSavingAvailability] = useState(false)
  const [availability, setAvailability] = useState(emptyAvailability)
  const [adminPassword, setAdminPassword] = useState('')
  const [adminUnavailableDates, setAdminUnavailableDates] = useState([])
  const [adminFullyBooked, setAdminFullyBooked] = useState(false)
  const [adminLoggedIn, setAdminLoggedIn] = useState(false)
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dni: '',
    plate: '',
    startDate: '',
  })
  const checkoutStatus = new URLSearchParams(window.location.search).get('checkout')

  useEffect(() => {
    let ignore = false

    async function loadAvailability() {
      try {
        setAvailabilityError('')
        setIsAvailabilityLoading(true)
        const data = await requestAvailability()

        if (ignore) {
          return
        }

        setAvailability(data)
        setAdminUnavailableDates(data.unavailableDates)
        setAdminFullyBooked(Boolean(data.isFullyBooked))
        setCheckoutForm((current) => {
          const monthAvailableDates = data.calendar.filter(
            (date) => date.available && isCurrentMonthDate(date.iso),
          )
          const selectedStillAvailable = monthAvailableDates.some((date) => date.iso === current.startDate)

          return {
            ...current,
            startDate: selectedStillAvailable
              ? current.startDate
              : (monthAvailableDates[0]?.iso ?? ''),
          }
        })
      } catch (error) {
        if (!ignore) {
          setAvailabilityError(
            error instanceof Error
              ? error.message
              : 'No se pudo cargar la disponibilidad.',
          )
        }
      } finally {
        if (!ignore) {
          setIsAvailabilityLoading(false)
        }
      }
    }

    void loadAvailability()

    return () => {
      ignore = true
    }
  }, [])

  const currentMonthCalendar = availability.calendar.filter((date) => isCurrentMonthDate(date.iso))
  const currentMonthAvailableDates = currentMonthCalendar.filter((date) => date.available)
  const heroAvailabilityText = isAvailabilityLoading
    ? 'Cargando fechas...'
    : availability.isFullyBooked
      ? 'Estamos completos'
      : currentMonthAvailableDates.length > 0
        ? `${currentMonthAvailableDates.length} fechas disponibles este mes`
        : 'Sin fechas disponibles este mes'

  const selectedCharge = checkoutForm.startDate
    ? calculateFirstMonthCharge(checkoutForm.startDate)
    : null

  function closeMobileMenu() {
    setIsMobileMenuOpen(false)
  }

  function openCheckoutModal() {
    setPaymentError('')
    closeMobileMenu()
    setIsCheckoutModalOpen(true)
  }

  function closeCheckoutModal() {
    if (isRedirectingToCheckout) {
      return
    }

    setIsCheckoutModalOpen(false)
  }

  function openAdminModal() {
    setAdminError('')
    setAdminSuccess('')
    setAdminPassword('')
    setAdminLoggedIn(false)
    setAdminUnavailableDates(availability.unavailableDates)
    setAdminFullyBooked(availability.isFullyBooked)
    closeMobileMenu()
    setIsAdminModalOpen(true)
  }

  function closeAdminModal() {
    if (isSavingAvailability) {
      return
    }

    setIsAdminModalOpen(false)
  }

  function updateCheckoutField(field, value) {
    setCheckoutForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function toggleAdminDate(dateIso) {
    setAdminSuccess('')
    setAdminError('')
    setAdminUnavailableDates((current) => (
      current.includes(dateIso)
        ? current.filter((value) => value !== dateIso)
        : [...current, dateIso].sort((left, right) => left.localeCompare(right))
    ))
  }

  async function handleSaveAvailability(event) {
    event.preventDefault()

    if (!adminPassword) {
      setAdminError('Escribe la contraseña del panel admin antes de guardar.')
      return
    }

    try {
      setIsSavingAvailability(true)
      setAdminError('')
      setAdminSuccess('')

      const response = await fetch(`${apiBaseUrl}/api/admin/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: adminPassword,
          unavailableDates: adminUnavailableDates,
          isFullyBooked: adminFullyBooked,
        }),
      })

      const responseText = await response.text()
      let data = {}

      if (responseText) {
        try {
          data = JSON.parse(responseText)
        } catch {
          throw new Error('La API admin no ha devuelto JSON válido.')
        }
      }

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo guardar la disponibilidad.')
      }

      const savedAvailability = normalizeAvailabilityResponse(data, {
        ...availability,
        unavailableDates: adminUnavailableDates,
        isFullyBooked: adminFullyBooked,
      })
      let nextAvailability = savedAvailability

      try {
        nextAvailability = await requestAvailability()
      } catch {
        nextAvailability = savedAvailability
      }

      setAvailability(nextAvailability)
      setAdminUnavailableDates(nextAvailability.unavailableDates)
      setAdminFullyBooked(nextAvailability.isFullyBooked)
      setCheckoutForm((current) => {
        const monthAvailableDates = nextAvailability.calendar.filter(
          (date) => date.available && isCurrentMonthDate(date.iso),
        )
        const selectedStillAvailable = monthAvailableDates.some(
          (date) => date.iso === current.startDate,
        )

        return {
          ...current,
          startDate: selectedStillAvailable
            ? current.startDate
            : (monthAvailableDates[0]?.iso ?? ''),
        }
      })
      setAdminSuccess('Disponibilidad guardada correctamente.')
    } catch (error) {
      setAdminError(
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la disponibilidad.',
      )
    } finally {
      setIsSavingAvailability(false)
    }
  }

  async function handleAdminLogin(event) {
    event.preventDefault()

    if (!adminPassword) {
      setAdminError('Escribe la contraseña de administración.')
      return
    }

    try {
      setAdminError('')
      setIsVerifyingPassword(true)

      const response = await fetch(`${apiBaseUrl}/api/admin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Contraseña incorrecta.')
      }

      setAdminLoggedIn(true)
      setAdminError('')
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Contraseña incorrecta.')
    } finally {
      setIsVerifyingPassword(false)
    }
  }

  async function handleStripeCheckout(event) {
    event.preventDefault()

    if (availability.isFullyBooked) {
      setPaymentError('Estamos completos en este momento.')
      return
    }

    if (currentMonthAvailableDates.length === 0) {
      setPaymentError('No quedan fechas de entrada disponibles este mes.')
      return
    }

    if (
      !checkoutForm.firstName ||
      !checkoutForm.lastName ||
      !checkoutForm.email ||
      !checkoutForm.phone ||
      !checkoutForm.dni ||
      !checkoutForm.plate ||
      !checkoutForm.startDate
    ) {
      setPaymentError('Completa nombre, apellido, email, teléfono, DNI, matrícula y fecha antes de continuar.')
      return
    }

    try {
      setPaymentError('')
      setIsRedirectingToCheckout(true)

      const response = await fetch(`${apiBaseUrl}/api/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(checkoutForm),
      })

      const responseText = await response.text()
      let data = null

      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch {
        throw new Error('La API no ha devuelto JSON. Revisa que el backend o la función de Netlify estén desplegados.')
      }

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'No se pudo iniciar el pago con Stripe.')
      }

      setIsCheckoutModalOpen(false)
      window.location.href = data.url
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : 'No se pudo iniciar el pago con Stripe.',
      )
      setIsRedirectingToCheckout(false)
    }
  }

  return (
    <main className="page-shell" id="top">
      {checkoutStatus === 'success' ? (
        <div className="status-banner success-banner">
          Pago iniciado correctamente. El alta inicial se ha enviado a Stripe y la renovación quedará programada para el primer día de cada mes.
        </div>
      ) : null}

      {checkoutStatus === 'cancel' ? (
        <div className="status-banner cancel-banner">
          El pago se ha cancelado. Puedes volver a intentarlo cuando quieras.
        </div>
      ) : null}

      {availabilityError ? (
        <div className="status-banner error-banner">{availabilityError}</div>
      ) : null}

      {paymentError ? (
        <div className="status-banner error-banner">{paymentError}</div>
      ) : null}

      <header className="site-header">
        <a className="brand-lockup" href="#top">
          <img className="brand-mark" src={logoImage} alt={BRAND_NAME} width="88" height="88" fetchpriority="high" />
          <div>
            <p className="brand-name">{BRAND_NAME}</p>
            <p className="brand-subtitle">Parking mensual para caravanas</p>
          </div>
        </a>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={isMobileMenuOpen}
          aria-controls="main-nav"
          aria-label={isMobileMenuOpen ? 'Cerrar menú principal' : 'Abrir menú principal'}
          onClick={() => setIsMobileMenuOpen((current) => !current)}
        >
          <span className="mobile-menu-toggle-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>Menú</span>
        </button>

        <nav
          id="main-nav"
          className={isMobileMenuOpen ? 'main-nav main-nav-open' : 'main-nav'}
          aria-label="Menú principal"
        >
          {navItems.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMobileMenu}>
              {item.label}
            </a>
          ))}
          <button className="nav-admin-button" type="button" onClick={openAdminModal}>
            Admin
          </button>
        </nav>

        <button
          className="header-pay-button"
          type="button"
          onClick={openCheckoutModal}
          disabled={isRedirectingToCheckout || isAvailabilityLoading}
        >
          {isRedirectingToCheckout ? 'Redirigiendo...' : 'Reservar plaza'}
        </button>
      </header>

      <section className="hero-section modern-hero">
        <div className="hero-copy">
          <p className="eyebrow">Parking mensual para caravanas</p>
          <h1>
            Reserva una plaza en Humanes
            <span className="hero-subtitle">con alta inicial prorrateada y renovación fija el primer día de cada mes.</span>
          </h1>

          <aside className="hero-panel offer-panel" aria-label="Resumen comercial principal">
            <p className="panel-label">Resumen principal</p>
            <div className="hero-panel-grid">
              <div>
                <span className="hero-panel-key">Aparcamiento</span>
                <p>Hormigonado y dentro de polígono industrial.</p>
              </div>
              <div>
                <span className="hero-panel-key">Alta inicial</span>
                <p>2 euros al dia hasta final de mes.</p>
              </div>
              <div>
                <span className="hero-panel-key">Renovacion</span>
                <p>{formatCurrency(MONTHLY_RATE_CENTS)} el primer dia de cada mes.</p>
              </div>
              <div>
                <span className="hero-panel-key">Teléfono</span>
                <a href="tel:+34649448383">+34 649 448 383</a>
              </div>
              <div>
                <span className="hero-panel-key">Email</span>
                <a href="mailto:ganiveamaja@gmail.com">ganiveamaja@gmail.com</a>
              </div>
              <div>
                <span className="hero-panel-key">Disponibilidad</span>
                <p>{heroAvailabilityText}</p>
              </div>
            </div>

            <div className="hero-panel-actions">
              <a className="hero-panel-link" href={mapsUrl} target="_blank" rel="noreferrer">
                Ver en Google Maps
              </a>
              <a className="secondary-action inline-link" href="#tarifa">
                Ver tarifa y pago
              </a>
            </div>
          </aside>

          <p className="lead">
            {BRAND_NAME} deja claro desde la primera pantalla cuánto se paga al entrar,
            cuándo se renueva y qué fechas siguen libres. La idea es vender mejor sin
            complicarte la gestión diaria.
          </p>

          <div className="hero-actions">
            <button
              className="primary-action payment-button"
              type="button"
              onClick={openCheckoutModal}
              disabled={isRedirectingToCheckout || isAvailabilityLoading}
            >
              {isRedirectingToCheckout ? 'Redirigiendo a Stripe...' : 'Reservar con Stripe'}
            </button>
            <a className="secondary-action" href="#contacto">
              Contactar ahora
            </a>
          </div>

          <div className="metrics-row">
            {quickFacts.map((item) => (
              <article className="metric-card" key={item.label}>
                <span>{item.value}</span>
                <p>{item.label}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="highlights-grid" id="ventajas" aria-label="Ventajas principales">
        {featureCards.map((item) => (
          <article className="info-card feature-card" key={item.title}>
            <p className="section-kicker">Ventaja</p>
            <h2>{item.title}</h2>
            <p>{item.text}</p>
          </article>
        ))}
      </section>

      <section className="split-section enriched-section">
        <div>
          <p className="section-kicker">Por qué elegir {BRAND_NAME}</p>
          <h2>Una landing más útil para vender, cobrar mejor y controlar la ocupación real.</h2>
          <p className="section-lead">
            Ya no dependes de un calendario fijo en el frontend. Las fechas disponibles se
            leen del backend y el primer cobro se calcula automáticamente según el día de entrada.
          </p>
        </div>

        <div className="service-list value-list">
          {valueItems.map((item, index) => (
            <div className="service-row" key={item}>
              <span className="service-mark">{String(index + 1).padStart(2, '0')}</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="location-section" id="ubicacion">
        <div className="location-copy">
          <p className="section-kicker">Ubicación y acceso</p>
          <h2>Mover la caravana nunca fue tan fácil.</h2>
          <p>
            La cercanía con Fuenlabrada, Humanes y Moraleja de En Medio lo
            convierte en un punto práctico para guardar el vehículo y tenerlo accesible.
          </p>
          <div className="location-points">
            <div>
              <span className="hero-panel-key">Entorno</span>
              <p>Polígono industrial con accesos naturales para vehículos de mayor volumen.</p>
            </div>
            <div>
              <span className="hero-panel-key">Superficie</span>
              <p>Base hormigonada para una estancia mensual más cómoda y ordenada.</p>
            </div>
            <div>
              <span className="hero-panel-key">Referencia visual</span>
              <p>La puerta y el punto exacto pueden revisarse directamente en Google Maps.</p>
            </div>
          </div>
        </div>

        <a className="location-visual" href={mapsUrl} target="_blank" rel="noreferrer">
          <img src={gatePhotoUrl} alt="Acceso al aparcamiento en Google Maps" width="630" height="420" loading="lazy" />
          <div className="location-visual-copy">
            <span className="section-kicker">Acceso visual</span>
            <strong>Consulta la entrada antes de venir</strong>
            <p>Abre Google Maps y revisa el acceso exacto al recinto.</p>
          </div>
        </a>
      </section>

      <section className="tariff-section" id="tarifa">
        <div className="tariff-copy">
          <p className="section-kicker">Tarifa y renovación</p>
          <h2>Primer pago flexible. Luego cuota fija el primer día de cada mes.</h2>
          <p>
            El alta inicial se prorratea a 2 euros por día hasta fin de mes. Desde el siguiente
            ciclo, la plaza se renueva automáticamente por {formatCurrency(MONTHLY_RATE_CENTS)} al mes.
          </p>
        </div>

        <div className="tariff-card">
          <p className="tariff-label">Plaza mensual</p>
          <h3>{formatCurrency(MONTHLY_RATE_CENTS)}</h3>
          <p className="tariff-note">Entrada inicial calculada por días restantes del mes a 2 euros al día.</p>
          <ul className="tariff-list">
            <li>Primer cobro prorrateado hasta el último día del mes.</li>
            <li>Renovación automática el primer día de cada mes.</li>
            <li>Fechas controladas desde panel admin y backend.</li>
          </ul>
          <div className="tariff-actions">
            <button
              className="primary-action payment-button"
              type="button"
              onClick={openCheckoutModal}
              disabled={isRedirectingToCheckout || isAvailabilityLoading}
            >
              {isRedirectingToCheckout ? 'Redirigiendo a Stripe...' : 'Reservar con Stripe'}
            </button>
            <a className="secondary-action" href="#contacto">
              Consultar antes de pagar
            </a>
          </div>
        </div>
      </section>

      <section className="process-section" id="proceso">
        <div className="process-header">
          <p className="section-kicker">Proceso</p>
          <h2>Un flujo más claro tanto para el cliente como para ti.</h2>
        </div>

        <div className="process-grid">
          {processSteps.map((step, index) => (
            <article className="process-card" key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="faq-section">
        <div className="faq-header">
          <p className="section-kicker">Preguntas frecuentes</p>
          <h2>La parte comercial y la operativa quedan explicadas sin depender de llamadas previas.</h2>
        </div>

        <div className="faq-grid">
          {faqItems.map((item) => (
            <article className="faq-card" key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="contact-section" id="contacto">
        <div>
          <p className="section-kicker">Contacto</p>
          <h2>Habla directamente, revisa disponibilidad o paga online cuando lo tengas claro.</h2>
        </div>

        <div className="contact-card modern-contact-card">
          <div className="contact-details">
            <div>
              <span className="contact-label">Teléfono</span>
              <a href="tel:+34649448383">+34 649 448 383</a>
            </div>
            <div>
              <span className="contact-label">Email</span>
              <a href="mailto:ganiveamaja@gmail.com">ganiveamaja@gmail.com</a>
            </div>
            <div>
              <span className="contact-label">Dirección</span>
              <p>Calle Malva 4, Humanes</p>
            </div>
            <div>
              <span className="contact-label">Renovacion mensual</span>
              <p>{formatCurrency(MONTHLY_RATE_CENTS)} el primer dia de cada mes</p>
            </div>
          </div>

          <div className="contact-actions-row">
            <button
              className="primary-action payment-button"
              type="button"
              onClick={openCheckoutModal}
              disabled={isRedirectingToCheckout || isAvailabilityLoading}
            >
              {isRedirectingToCheckout ? 'Redirigiendo a Stripe...' : 'Reservar con Stripe'}
            </button>
            <a className="secondary-action call-action" href="tel:+34649448383">
              Llamar ahora
            </a>
            <a className="secondary-action" href={mapsUrl} target="_blank" rel="noreferrer">
              Abrir ubicación
            </a>
          </div>
        </div>
      </section>

      {isCheckoutModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCheckoutModal}>
          <div
            className="checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="checkout-modal-header">
              <div>
                <p className="section-kicker">Reserva y pago</p>
                <h2 id="checkout-modal-title">
                  {availability.isFullyBooked
                    ? 'Lo sentimos, estamos completos.'
                    : 'Antes de pagar, completa tus datos.'}
                </h2>
              </div>
              <button className="modal-close" type="button" onClick={closeCheckoutModal}>
                Cerrar
              </button>
            </div>

            {availability.isFullyBooked ? (
              <div className="full-capacity-panel">
                <p>
                  Lo sentimos, estamos completos en este momento y no podemos aceptar nuevas reservas.
                </p>
                <div className="checkout-actions">
                  <button className="secondary-action" type="button" onClick={closeCheckoutModal}>
                    Cerrar
                  </button>
                  <a className="primary-action payment-button" href="#contacto" onClick={closeCheckoutModal}>
                    Contactar
                  </a>
                </div>
              </div>
            ) : (
            <form className="checkout-form" onSubmit={handleStripeCheckout}>
              <label className="form-field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={checkoutForm.firstName}
                  onChange={(event) => updateCheckoutField('firstName', event.target.value)}
                  placeholder="Javier"
                  required
                />
              </label>

              <label className="form-field">
                <span>Apellido</span>
                <input
                  type="text"
                  value={checkoutForm.lastName}
                  onChange={(event) => updateCheckoutField('lastName', event.target.value)}
                  placeholder="Garcia"
                  required
                />
              </label>

              <label className="form-field">
                <span>Email</span>
                <input
                  type="email"
                  value={checkoutForm.email}
                  onChange={(event) => updateCheckoutField('email', event.target.value.trim())}
                  placeholder="cliente@email.com"
                  required
                />
              </label>

              <label className="form-field">
                <span>Telefono</span>
                <input
                  type="tel"
                  value={checkoutForm.phone}
                  onChange={(event) => updateCheckoutField('phone', event.target.value)}
                  placeholder="+34 600 000 000"
                  required
                />
              </label>

              <label className="form-field">
                <span>DNI</span>
                <input
                  type="text"
                  value={checkoutForm.dni}
                  onChange={(event) => updateCheckoutField('dni', event.target.value.toUpperCase())}
                  placeholder="12345678A"
                  required
                />
              </label>

              <label className="form-field">
                <span>Matricula de la caravana</span>
                <input
                  type="text"
                  value={checkoutForm.plate}
                  onChange={(event) => updateCheckoutField('plate', event.target.value.toUpperCase())}
                  placeholder="1234ABC"
                  required
                />
              </label>

              <div className="date-picker-block">
                <div>
                  <span className="section-kicker">Fechas de entrada</span>
                  <p className="date-picker-help">
                    Se muestran solo las fechas que quedan de este mes. Las bloqueadas también aparecen para que veas la ocupación real.
                  </p>
                </div>

                {availability.isFullyBooked ? (
                  <p className="date-picker-help full-capacity-message">Estamos completos en este momento.</p>
                ) : null}

                <div className="available-dates-grid">
                  {currentMonthCalendar.map((date) => (
                    <button
                      key={date.iso}
                      className={[
                        'date-option',
                        date.available ? 'available-date' : 'blocked-date',
                        date.iso === checkoutForm.startDate ? 'selected-date' : '',
                      ].filter(Boolean).join(' ')}
                      type="button"
                      onClick={() => {
                        if (date.available) {
                          updateCheckoutField('startDate', date.iso)
                        }
                      }}
                      disabled={!date.available || availability.isFullyBooked}
                    >
                      <span>{date.weekday}</span>
                      <strong>{date.label}</strong>
                      <small>{date.available ? 'Disponible' : 'No disponible'}</small>
                    </button>
                  ))}
                </div>

                {!isAvailabilityLoading && currentMonthCalendar.length === 0 ? (
                  <p className="date-picker-help">No quedan fechas por mostrar en el mes actual.</p>
                ) : null}

                {!isAvailabilityLoading && currentMonthCalendar.length > 0 && currentMonthAvailableDates.length === 0 ? (
                  <p className="date-picker-help">No quedan fechas de entrada libres este mes.</p>
                ) : null}
              </div>

              {selectedCharge ? (
                <div className="charge-summary">
                  <p className="section-kicker">Resumen del cobro</p>
                  <div className="charge-summary-grid">
                    <div>
                      <span className="hero-panel-key">Entrada</span>
                      <p>{selectedCharge.startDateIso}</p>
                    </div>
                    <div>
                      <span className="hero-panel-key">Alta inicial</span>
                      <p>{selectedCharge.amountLabel}</p>
                    </div>
                    <div>
                      <span className="hero-panel-key">Días incluidos</span>
                      <p>{selectedCharge.daysRemaining} días a {selectedCharge.dailyRateLabel}/día</p>
                    </div>
                    <div>
                      <span className="hero-panel-key">Siguiente cobro</span>
                      <p>{selectedCharge.nextBillingDateLabel}</p>
                    </div>
                  </div>
                  <p className="charge-summary-note">
                    Desde esa fecha, Stripe renovará la plaza por {selectedCharge.monthlyRateLabel} al mes.
                  </p>
                </div>
              ) : null}

              <div className="checkout-actions">
                <button className="primary-action payment-button" type="submit" disabled={isRedirectingToCheckout || availability.isFullyBooked}>
                  {isRedirectingToCheckout ? 'Redirigiendo a Stripe...' : 'Continuar al pago'}
                </button>
                <button className="secondary-action" type="button" onClick={closeCheckoutModal}>
                  Cancelar
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      ) : null}

      {isAdminModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeAdminModal}>
          <div
            className="checkout-modal admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="checkout-modal-header">
              <div>
                <p className="section-kicker">Admin</p>
                <h2 id="admin-modal-title">
                  {adminLoggedIn ? 'Gestiona las fechas disponibles.' : 'Acceso de administración.'}
                </h2>
                {adminLoggedIn ? (
                  <p className="admin-meta">Última actualización: {formatUpdatedAt(availability.updatedAt)}</p>
                ) : null}
              </div>
              <button className="modal-close" type="button" onClick={closeAdminModal}>
                Cerrar
              </button>
            </div>

            {!adminLoggedIn ? (
              <form className="admin-card" onSubmit={handleAdminLogin}>
                <label className="form-field">
                  <span>Contraseña admin</span>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    placeholder="Introduce la contraseña"
                    autoFocus
                  />
                </label>

                {adminError ? <p className="admin-feedback error-text">{adminError}</p> : null}

                <div className="checkout-actions">
                  <button className="primary-action payment-button" type="submit" disabled={isVerifyingPassword}>
                    {isVerifyingPassword ? 'Verificando...' : 'Acceder'}
                  </button>
                  <button className="secondary-action" type="button" onClick={closeAdminModal}>
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form className="admin-card" onSubmit={handleSaveAvailability}>
                <label className="admin-toggle-row">
                  <input
                    type="checkbox"
                    checked={adminFullyBooked}
                    onChange={(event) => setAdminFullyBooked(event.target.checked)}
                  />
                  <span>Marcar como completo (bloquea todas las reservas)</span>
                </label>

                <div className="admin-months-wrapper">
                  {buildAdminCalendarMonths(availability.calendar).map((monthData) => {
                    const { year, month } = monthData
                    const daysInMonth = new Date(year, month, 0).getDate()
                    const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
                    const offset = (firstDayOfWeek + 6) % 7
                    const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-ES', {
                      month: 'long',
                      year: 'numeric',
                    })

                    const cells = []
                    for (let i = 0; i < offset; i++) {
                      cells.push({ type: 'empty', key: `empty-${year}-${month}-${i}` })
                    }
                    for (let d = 1; d <= daysInMonth; d++) {
                      const iso = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                      cells.push({
                        type: 'day',
                        key: iso,
                        iso,
                        day: d,
                        inRange: Boolean(monthData.dates[iso]),
                        blocked: adminUnavailableDates.includes(iso),
                      })
                    }

                    return (
                      <div key={`${year}-${month}`} className="admin-month-calendar">
                        <p className="admin-month-name">
                          {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                        </p>
                        <div className="admin-weekday-row">
                          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                            <span key={d}>{d}</span>
                          ))}
                        </div>
                        <div className="admin-month-grid">
                          {cells.map((cell) =>
                            cell.type === 'empty' ? (
                              <div key={cell.key} className="admin-cal-empty" />
                            ) : !cell.inRange ? (
                              <div key={cell.key} className="admin-cal-day admin-cal-outside">
                                <strong>{cell.day}</strong>
                              </div>
                            ) : (
                              <button
                                key={cell.key}
                                type="button"
                                className={`admin-cal-day ${cell.blocked ? 'admin-cal-blocked' : 'admin-cal-open'}`}
                                onClick={() => toggleAdminDate(cell.iso)}
                                disabled={isAvailabilityLoading || isSavingAvailability}
                              >
                                <strong>{cell.day}</strong>
                                <small>{cell.blocked ? '✗' : '✓'}</small>
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {adminError ? <p className="admin-feedback error-text">{adminError}</p> : null}
                {adminSuccess ? <p className="admin-feedback success-text">{adminSuccess}</p> : null}

                <div className="checkout-actions">
                  <button className="primary-action payment-button" type="submit" disabled={isSavingAvailability}>
                    {isSavingAvailability ? 'Guardando...' : 'Guardar disponibilidad'}
                  </button>
                  <button className="secondary-action" type="button" onClick={closeAdminModal}>
                    Cerrar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
