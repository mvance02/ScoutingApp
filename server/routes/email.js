import { Router } from 'express'
import nodemailer from 'nodemailer'
import { logAudit, getClientIp } from '../middleware/audit.js'

const router = Router()

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = String(process.env.SMTP_SECURE || 'false') === 'true'

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

function getCoachEmailForGroup(positionGroup) {
  const override = process.env.COACH_EMAIL_OVERRIDE
  if (override) return override

  const mapping = {
    QB: process.env.COACH_EMAIL_QB,
    RB: process.env.COACH_EMAIL_RB,
    WR: process.env.COACH_EMAIL_WR,
    TE: process.env.COACH_EMAIL_TE,
    OL: process.env.COACH_EMAIL_OL,
    DL: process.env.COACH_EMAIL_DL,
    EDGE: process.env.COACH_EMAIL_EDGE,
    LB: process.env.COACH_EMAIL_LB,
    DB: process.env.COACH_EMAIL_DB,
    ATH: process.env.COACH_EMAIL_ATH,
  }

  return mapping[positionGroup]
}

router.post('/game-day', async (req, res, next) => {
  try {
    const { date, attachments } = req.body
    if (!attachments || attachments.length === 0) {
      return res.status(400).json({ error: 'No attachments provided' })
    }

    const transporter = getTransporter()
    if (!transporter) {
      return res.status(500).json({ error: 'Email transport not configured' })
    }

    const from = process.env.EMAIL_FROM || 'scouting@localhost'
    const results = []

    for (const item of attachments) {
      const to = getCoachEmailForGroup(item.positionGroup)
      if (!to) {
        results.push({ positionGroup: item.positionGroup, status: 'skipped', reason: 'missing coach email' })
        continue
      }

      const mail = {
        from,
        to,
        subject: `Game Day Report - ${item.positionGroup} - ${date}`,
        text: `Attached is the ${item.positionGroup} game day report for ${date}.`,
        attachments: [
          {
            filename: item.filename,
            content: Buffer.from(item.data, 'base64'),
            contentType: 'application/pdf',
          },
        ],
      }

      await transporter.sendMail(mail)
      results.push({ positionGroup: item.positionGroup, status: 'sent', to })

      await logAudit({
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: 'EMAIL',
        tableName: 'email_exports',
        recordId: null,
        oldValues: null,
        newValues: {
          date,
          positionGroup: item.positionGroup,
          to,
          filename: item.filename,
        },
        ipAddress: getClientIp(req),
      })
    }

    res.json({ status: 'ok', results })
  } catch (err) {
    next(err)
  }
})

router.post('/recruits-report', async (req, res, next) => {
  try {
    const { weekStart, attachment } = req.body
    if (!attachment) {
      return res.status(400).json({ error: 'Attachment required' })
    }

    const transporter = getTransporter()
    if (!transporter) {
      return res.status(500).json({ error: 'Email transport not configured' })
    }

    const from = process.env.EMAIL_FROM || 'scouting@localhost'
    const to = process.env.COACH_EMAIL_OVERRIDE
    if (!to) {
      return res.status(400).json({ error: 'COACH_EMAIL_OVERRIDE not set' })
    }

    const mail = {
      from,
      to,
      subject: `Recruits Weekly Report - ${weekStart}`,
      text: `Attached is the recruits report for the week starting ${weekStart}.`,
      attachments: [
        {
          filename: attachment.filename,
          content: Buffer.from(attachment.data, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    }

    await transporter.sendMail(mail)

    await logAudit({
      userId: req.user?.id,
      userEmail: req.user?.email,
      action: 'EMAIL',
      tableName: 'recruits_report',
      recordId: null,
      newValues: {
        weekStart,
        to,
        filename: attachment.filename,
      },
      ipAddress: getClientIp(req),
    })

    res.json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
})

export default router
