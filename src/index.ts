import 'dotenv/config'
import { Telegraf, Context, session } from 'telegraf'
import { message } from 'telegraf/filters'
import type { InputMediaPhoto } from 'telegraf/types'

import { search } from './api.ts'
import {
  scheduleCatalogJob,
  listCatalogJobs,
  removeCatalogJob,
} from './cron.ts'

type SessionData = {
  step?: 'awaiting_keyword' | 'awaiting_condition' | 'awaiting_stop_selection'
  keyword?: string
}

interface MyContext extends Context {
  session: SessionData
}

const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_TOKEN || '')

bot.use(session({ defaultSession: () => ({}) }))

// 🟢 Mulai proses pantauan baru
bot.command('start', async (ctx) => {
  ctx.session.step = 'awaiting_keyword'
  await ctx.reply(
    'Masukkan kata kunci pencarian produk (contoh: "vivo v50 12/256")'
  )
})

// 🔴 Hentikan salah satu pantauan aktif
bot.command('stop', async (ctx) => {
  const jobs = listCatalogJobs(ctx.chat.id)

  if (jobs.length === 0) {
    await ctx.reply('⚠️ Tidak ada pantauan aktif.')
    return
  }

  ctx.session.step = 'awaiting_stop_selection'
  ctx.session.keyword = JSON.stringify(jobs) // simpan sementara

  const options = jobs
    .map((job, index) => `${index + 1}. <b>${job.keyword}</b> (${job.label})`)
    .join('\n')

  await ctx.reply(`Pilih nomor pantauan yang ingin dihentikan:\n${options}`, {
    parse_mode: 'HTML',
  })
})

// 📩 Tangani pesan teks dari user berdasarkan step
bot.on(message('text'), async (ctx) => {
  const step = ctx.session.step

  if (step === 'awaiting_keyword') {
    ctx.session.keyword = ctx.message.text
    ctx.session.step = 'awaiting_condition'

    await ctx.reply('Pilih kondisi produk:\n1. Semua\n2. Baru\n3. Bekas')
    return
  }

  if (step === 'awaiting_condition') {
    const conditionChoice = ctx.message.text.trim()
    let source: 'search' | 'universe' = 'search'
    let condition: '1' | '2' | undefined

    if (conditionChoice === '1') {
      source = 'search'
    } else if (conditionChoice === '2') {
      source = 'universe'
      condition = '1'
    } else if (conditionChoice === '3') {
      source = 'universe'
      condition = '2'
    } else {
      await ctx.reply('⚠️ Input tidak valid. Balas dengan angka 1, 2, atau 3.')
      return
    }

    const keyword = ctx.session.keyword || ''
    ctx.session = {} // reset sesi

    const result = await scheduleCatalogJob(ctx, keyword, source, condition)
    if (result.success) {
      await ctx.reply(
        '✅ Jadwal pantauan dibuat. Katalog akan dikirim setiap 6 jam.'
      )
    } else {
      await ctx.reply(`⚠️ Gagal membuat jadwal: ${result.reason}`)
    }

    const products = await search({ q: keyword, source, condition })

    if (products.length === 0) {
      await ctx.reply('📭 Produk tidak ditemukan.')
      return
    }

    const mediaGroup: InputMediaPhoto[] = products
      .slice(0, 10)
      .map((product) => ({
        type: 'photo',
        media: product.image,
        caption: `📦 <a href="${product.url}">${product.name}</a>\n💰 <b>${product.price}</b>\n🏬 ${product.shopName} - ${product.shopCity}`,
        parse_mode: 'HTML',
      }))

    await ctx.replyWithMediaGroup(mediaGroup)
    return
  }

  if (step === 'awaiting_stop_selection') {
    const choice = parseInt(ctx.message.text.trim())
    const raw = ctx.session.keyword
    if (!raw) {
      await ctx.reply('⚠️ Data pantauan tidak ditemukan.')
      return
    }

    const jobs: { jobId: string; keyword: string; label: string }[] =
      JSON.parse(raw)

    if (isNaN(choice) || choice < 1 || choice > jobs.length) {
      await ctx.reply('⚠️ Pilihan tidak valid. Ketik nomor dari daftar.')
      return
    }

    const selected = jobs[choice - 1]
    const removed = removeCatalogJob(selected.jobId)

    ctx.session = {} // reset sesi

    if (removed) {
      await ctx.reply(
        `🛑 Pantauan <b>${selected.keyword}</b> (${selected.label}) dihentikan.`,
        { parse_mode: 'HTML' }
      )
    } else {
      await ctx.reply('⚠️ Gagal menghentikan pantauan.')
    }
    return
  }
})

bot.launch()
