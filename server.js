import { randomUUID } from 'node:crypto'
import dotenv from 'dotenv'
import express from 'express'
import { MongoClient } from 'mongodb'
import Stripe from 'stripe'
import {
  BRAND_NAME,
  buildAvailabilityPayload,
  calculateFirstMonthCharge,
  normalizeDateList,
  normalizeIsoDate,
} from './booking.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 4242)
const mongoUri = process.env.MONGODB_URI
const mongoDbName = process.env.MONGODB_DB_NAME || 'caravanas'
const mongoClient = mongoUri ? new MongoClient(mongoUri) : null
const adminPanelPassword = process.env.ADMIN_PANEL_PASSWORD || ''

let reservationsCollection
let availabilityCollection

app.use(express.json())

app.use((request, response, next) => {
  const origin = request.headers.origin
  const allowedOrigins = new Set([process.env.APP_URL].filter(Boolean))
  const isLocalOrigin =
    typeof origin === 'string' &&
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

  if (origin && (allowedOrigins.has(origin) || isLocalOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }

  next()
})

async function connectToDatabase() {
  if (!mongoClient) {
    throw new Error('Falta configurar MONGODB_URI en el servidor.')
  }

  await mongoClient.connect()

  const database = mongoClient.db(mongoDbName)
  reservationsCollection = database.collection('reservations')
  availabilityCollection = database.collection('availabilitySettings')

  await reservationsCollection.createIndex({ id: 1 }, { unique: true })
  await reservationsCollection.createIndex({ createdAt: -1 })
  await availabilityCollection.createIndex({ updatedAt: -1 })
}

function getReservationsCollection() {
  if (!reservationsCollection) {
    throw new Error('La conexion con MongoDB no esta disponible.')
  }

  return reservationsCollection
}

function getAvailabilityCollection() {
  if (!availabilityCollection) {
    throw new Error('La conexion con MongoDB no esta disponible.')
  }

  return availabilityCollection
}

async function readReservations() {
  const collection = getReservationsCollection()
  const reservations = await collection.find({}).sort({ createdAt: -1 }).toArray()

  return reservations.map(({ _id, ...reservation }) => ({
    mongoId: _id.toString(),
    ...reservation,
  }))
}

async function appendReservation(reservation) {
  const collection = getReservationsCollection()
  await collection.insertOne(reservation)
}

async function updateReservation(reservationId, updates) {
  const collection = getReservationsCollection()
  await collection.updateOne(
    { id: reservationId },
    {
      $set: {
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    },
  )
}

async function readAvailabilitySettings() {
  const collection = getAvailabilityCollection()
  const settings = await collection.findOne({ _id: 'primary' })

  return {
    unavailableDates: normalizeDateList(settings?.unavailableDates),
    isFullyBooked: Boolean(settings?.isFullyBooked),
    updatedAt: settings?.updatedAt || null,
  }
}

async function updateAvailabilitySettings(unavailableDates, isFullyBooked = false) {
  const collection = getAvailabilityCollection()
  const normalizedDates = normalizeDateList(unavailableDates)
  const updatedAt = new Date().toISOString()

  await collection.updateOne(
    { _id: 'primary' },
    {
      $set: {
        unavailableDates: normalizedDates,
        isFullyBooked: Boolean(isFullyBooked),
        updatedAt,
      },
    },
    { upsert: true },
  )

  return {
    unavailableDates: normalizedDates,
    isFullyBooked: Boolean(isFullyBooked),
    updatedAt,
  }
}

function isAdminAuthorized(password) {
  return Boolean(adminPanelPassword) && String(password || '') === adminPanelPassword
}

app.post('/api/admin/verify', (request, response) => {
  if (!adminPanelPassword) {
    response.status(500).json({ error: 'Falta configurar ADMIN_PANEL_PASSWORD en el servidor.' })
    return
  }

  if (!isAdminAuthorized(request.body?.password)) {
    response.status(401).json({ error: 'Contraseña incorrecta.' })
    return
  }

  response.json({ ok: true })
})

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, database: reservationsCollection ? 'connected' : 'disconnected' })
})

app.get('/api/availability', async (_request, response) => {
  try {
    const settings = await readAvailabilitySettings()
    const availability = buildAvailabilityPayload(settings.unavailableDates)

    response.json({
      ...availability,
      isFullyBooked: settings.isFullyBooked,
      updatedAt: settings.updatedAt,
    })
  } catch (error) {
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo leer la disponibilidad.',
    })
  }
})

app.put('/api/admin/availability', async (request, response) => {
  try {
    if (!adminPanelPassword) {
      response.status(500).json({
        error: 'Falta configurar ADMIN_PANEL_PASSWORD en el servidor.',
      })
      return
    }

    if (!isAdminAuthorized(request.body?.password)) {
      response.status(401).json({
        error: 'Contrasena de administracion incorrecta.',
      })
      return
    }

    const unavailableDates = Array.isArray(request.body?.unavailableDates)
      ? request.body.unavailableDates
      : []
    const isFullyBooked = Boolean(request.body?.isFullyBooked)

    const settings = await updateAvailabilitySettings(unavailableDates, isFullyBooked)
    const availability = buildAvailabilityPayload(settings.unavailableDates)

    response.json({
      ...availability,
      isFullyBooked: settings.isFullyBooked,
      updatedAt: settings.updatedAt,
    })
  } catch (error) {
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo guardar la disponibilidad.',
    })
  }
})

app.get('/api/reservations', async (_request, response) => {
  try {
    const reservations = await readReservations()

    response.json({
      count: reservations.length,
      reservations,
    })
  } catch (error) {
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'No se pudieron leer las reservas guardadas.',
    })
  }
})

app.post('/api/create-checkout-session', async (request, response) => {
  let reservationId = ''

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      response.status(500).json({
        error: 'Falta configurar STRIPE_SECRET_KEY en el servidor.',
      })
      return
    }

    if (!mongoUri) {
      response.status(500).json({
        error: 'Falta configurar MONGODB_URI en el servidor.',
      })
      return
    }

    const { firstName, lastName, email, phone, dni, plate, startDate } = request.body ?? {}
    const normalizedStartDate = normalizeIsoDate(startDate)

    if (!firstName || !lastName || !email || !phone || !dni || !plate || !normalizedStartDate) {
      response.status(400).json({
        error: 'Nombre, apellido, email, telefono, DNI, matricula y fecha de entrada son obligatorios.',
      })
      return
    }

    const availabilitySettings = await readAvailabilitySettings()

    if (availabilitySettings.isFullyBooked) {
      response.status(400).json({
        error: 'Estamos completos en este momento.',
      })
      return
    }

    const availability = buildAvailabilityPayload(availabilitySettings.unavailableDates)
    const selectedDate = availability.availableDates.find((date) => date.iso === normalizedStartDate)

    if (!selectedDate) {
      response.status(400).json({
        error: 'La fecha seleccionada ya no esta disponible. Elige otra antes de pagar.',
      })
      return
    }

    const firstMonthCharge = calculateFirstMonthCharge(normalizedStartDate)

    if (!firstMonthCharge) {
      response.status(400).json({
        error: 'No se pudo calcular el primer pago prorrateado.',
      })
      return
    }

    reservationId = randomUUID()

    await appendReservation({
      id: reservationId,
      firstName: String(firstName),
      lastName: String(lastName),
      email: String(email),
      phone: String(phone),
      dni: String(dni),
      plate: String(plate),
      startDate: normalizedStartDate,
      firstMonthCharge,
      status: 'pending_checkout',
      createdAt: new Date().toISOString(),
    })

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl =
      request.headers.origin || process.env.APP_URL || 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      billing_address_collection: 'required',
      customer_email: String(email),
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: firstMonthCharge.amountCents,
            product_data: {
              name: `${BRAND_NAME} - alta inicial prorrateada`,
              description: `${firstMonthCharge.daysRemaining} dias hasta fin de mes a ${firstMonthCharge.dailyRateLabel} por dia.`,
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: firstMonthCharge.monthlyRateCents,
            recurring: {
              interval: 'month',
            },
            product_data: {
              name: `${BRAND_NAME} - plaza mensual`,
              description: `Renovacion mensual automatica el primer dia de cada mes desde ${firstMonthCharge.nextBillingDateLabel}.`,
            },
          },
        },
      ],
      subscription_data: {
        trial_end: firstMonthCharge.nextBillingAnchorUnix,
      },
      metadata: {
        business: BRAND_NAME,
        plan: 'alta-prorrateada-y-renovacion-mensual',
        reservationId,
        firstName: String(firstName),
        lastName: String(lastName),
        email: String(email),
        phone: String(phone),
        dni: String(dni),
        plate: String(plate),
        startDate: normalizedStartDate,
        firstMonthDays: String(firstMonthCharge.daysRemaining),
        firstMonthAmountCents: String(firstMonthCharge.amountCents),
        nextBillingDate: firstMonthCharge.nextBillingDateIso,
      },
    })

    await updateReservation(reservationId, {
      status: 'checkout_created',
      stripeSessionId: session.id,
    })

    response.json({ url: session.url, reservationId })
  } catch (error) {
    if (reservationId) {
      await updateReservation(reservationId, {
        status: 'checkout_failed',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'No se pudo crear la sesion de pago.',
      })
    }

    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo crear la sesion de pago.',
    })
  }
})

connectToDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Stripe API listening on http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('No se pudo conectar con MongoDB:', error)
    process.exit(1)
  })