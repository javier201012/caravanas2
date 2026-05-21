const adminPanelPassword = process.env.ADMIN_PANEL_PASSWORD || ''

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Metodo no permitido.' })
  }

  if (!adminPanelPassword) {
    return jsonResponse(500, { error: 'Falta configurar ADMIN_PANEL_PASSWORD en Netlify.' })
  }

  const payload = JSON.parse(event.body || '{}')

  if (String(payload?.password || '') !== adminPanelPassword) {
    return jsonResponse(401, { error: 'Contraseña incorrecta.' })
  }

  return jsonResponse(200, { ok: true })
}
