import 'dotenv/config'
import { Telegraf } from 'telegraf'
import { message } from 'telegraf/filters'
import { scheduleCheckout } from './cron.ts'

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)
const userState = new Map<number, { stage: 'email' | 'time'; email?: string }>()

const isValidEmail = (email: string) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)

const isValidTime = (input: string) =>
  /^([01]?\d|2[0-3]):([0-5]\d)$/.test(input)

bot.command('co', async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  userState.set(userId, { stage: 'email' })
  await ctx.reply('Masukkan email Anda:')
})

bot.command('cancel', async (ctx) => {
  const userId = ctx.from?.id
  if (userId && userState.has(userId)) {
    userState.delete(userId)
    await ctx.reply('❌ Input dibatalkan.')
  } else {
    await ctx.reply('Tidak ada proses yang sedang berlangsung.')
  }
})

bot.on(message('text'), async (ctx) => {
  const userId = ctx.from?.id
  if (!userId) return

  const state = userState.get(userId)
  if (!state) return

  const input = ctx.message.text.trim()

  if (state.stage === 'email') {
    if (!isValidEmail(input))
      return ctx.reply('Format email tidak valid. Masukkan email yang benar.')
    userState.set(userId, { stage: 'time', email: input })
    return ctx.reply('Masukkan waktu checkout (format hh:mm):')
  }

  if (state.stage === 'time') {
    if (!isValidTime(input))
      return ctx.reply('Format tidak valid. Gunakan hh:mm (contoh: 13:45)')

    const [hh, mm] = input.split(':').map(Number)
    const formatted = `${hh.toString().padStart(2, '0')}:${mm
      .toString()
      .padStart(2, '0')}`

    try {
      if (!state.email) throw new Error('Email tidak tersedia.')
      scheduleCheckout({ userId, email: state.email, time: formatted })
      await ctx.reply(
        `✅ Checkout dijadwalkan pukul ${formatted} untuk email ${state.email}`
      )
    } catch (err) {
      console.error(err)
      await ctx.reply('❌ Gagal menjadwalkan checkout. Silakan coba lagi.')
    }

    userState.delete(userId)
  }
})

bot.launch()
