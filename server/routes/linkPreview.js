import { Router } from 'express'

const router = Router()

router.post('/', async (req, res) => {
  const { url } = req.body

  if (!url || typeof url !== 'string') {
    return res.json({ title: null, description: null })
  }

  // Validate URL format
  let parsedUrl
  try {
    parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.json({ title: null, description: null })
    }
  } catch {
    return res.json({ title: null, description: null })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(parsedUrl.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BYUScoutingApp/1.0)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return res.json({ title: null, description: null })
    }

    const html = await response.text()

    // Extract <title> tag
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : null

    // Extract og:description
    const ogDescMatch = html.match(/<meta\s+(?:[^>]*?)property\s*=\s*["']og:description["'][^>]*?content\s*=\s*["']([\s\S]*?)["'][^>]*?\/?>/i)
      || html.match(/<meta\s+(?:[^>]*?)content\s*=\s*["']([\s\S]*?)["'][^>]*?property\s*=\s*["']og:description["'][^>]*?\/?>/i)
    const description = ogDescMatch ? (ogDescMatch[1] || ogDescMatch[2] || '').trim() : null

    res.json({ title, description })
  } catch {
    res.json({ title: null, description: null })
  }
})

export default router
