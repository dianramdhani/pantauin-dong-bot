import 'dotenv/config'
import { Telegraf, Context, session } from 'telegraf'
import { message } from 'telegraf/filters'

import {
  scheduleCatalogJob,
  listCatalogJobs,
  removeCatalogJob,
} from './catalogScheduler'

/**
 * Struktur data sesi per pengguna.
 * Menyimpan state percakapan dan input keyword yang sedang diproses.
 */
type SessionData = {
  step?: 'awaiting_keyword' | 'awaiting_condition' | 'awaiting_stop_selection'
  keyword?: string
}

/**
 * Tipe context kustom Telegraf yang menyertakan session.
 */
interface MyContext extends Context {
  session: SessionData
}

/**
 * Inisialisasi bot Telegram dengan token dari .env
 */
const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_TOKEN || '')

/**
 * Middleware session untuk menyimpan data sementara percakapan.
 */
bot.use(session({ defaultSession: () => ({}) }))

/**
 * /start — Memulai proses pemantauan katalog.
 * Meminta user untuk memasukkan keyword produk.
 */
bot.command('start', async (ctx) => {
  ctx.session.step = 'awaiting_keyword'
  await ctx.reply(
    'Masukkan kata kunci pencarian produk (contoh: "vivo v50 12/256")'
  )
})

/**
 * /stop — Menampilkan daftar pantauan aktif untuk dihentikan.
 * Mengatur state ke 'awaiting_stop_selection'.
 */
bot.command('stop', async (ctx) => {
  const jobs = listCatalogJobs(ctx.chat.id)

  if (jobs.length === 0) {
    await ctx.reply('⚠️ Tidak ada pantauan aktif.')
    return
  }

  ctx.session.step = 'awaiting_stop_selection'
  ctx.session.keyword = JSON.stringify(jobs) // Simpan daftar untuk dipilih

  const options = jobs
    .map((job, index) => `${index + 1}. <b>${job.keyword}</b> (${job.label})`)
    .join('\n')

  await ctx.reply(`Pilih nomor pantauan yang ingin dihentikan:\n${options}`, {
    parse_mode: 'HTML',
  })
})

/**
 * Handler untuk semua pesan teks dari user.
 * Menyesuaikan perilaku berdasarkan state sesi saat ini.
 */
bot.on(message('text'), async (ctx) => {
  const step = ctx.session.step

  /**
   * Tahap 1: User diminta memasukkan keyword.
   */
  if (step === 'awaiting_keyword') {
    ctx.session.keyword = ctx.message.text
    ctx.session.step = 'awaiting_condition'

    await ctx.reply('Pilih kondisi produk:\n1. Semua\n2. Baru\n3. Bekas')
    return
  }

  /**
   * Tahap 2: User memilih kondisi produk.
   * Setelah dipilih, jadwal pemantauan dibuat dan dijalankan.
   */
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
    ctx.session = {} // Reset sesi

    const result = await scheduleCatalogJob(ctx, keyword, source, condition)
    if (result.success) {
      await ctx.reply(
        '✅ Jadwal pantauan dibuat. Katalog akan dikirim setiap 6 jam.'
      )
    } else {
      await ctx.reply(`⚠️ Gagal membuat jadwal: ${result.reason}`)
    }

    return
  }

  /**
   * Tahap 3: User memilih pantauan mana yang ingin dihentikan.
   */
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

    ctx.session = {} // Reset sesi

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

/**
 * Meluncurkan bot Telegram.
 */
bot.launch()
