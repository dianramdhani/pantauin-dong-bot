import 'dotenv/config'
import { Telegraf, Context, session } from 'telegraf'
import { message } from 'telegraf/filters'
import {
  scheduleCatalogJob,
  listCatalogJobs,
  removeCatalogJob,
  restoreCatalogJobs,
} from './catalogScheduler'

/* ============================================================================
 * TIPE DATA & INITIAL SETUP
 * ============================================================================
 */

/**
 * Struktur sesi per pengguna, menyimpan tahap percakapan dan kata kunci.
 */
type SessionData = {
  step?: 'awaiting_keyword' | 'awaiting_condition' | 'awaiting_stop_selection'
  keyword?: string
}

/**
 * Context kustom Telegraf yang menyertakan session.
 */
interface MyContext extends Context {
  session: SessionData
}

/**
 * Inisialisasi bot Telegram menggunakan token dari file .env.
 */
const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_TOKEN || '')

/**
 * Middleware session untuk menyimpan data percakapan pengguna sementara.
 */
bot.use(session({ defaultSession: (): SessionData => ({}) }))

/* ============================================================================
 * PERINTAH UTAMA BOT
 * ============================================================================
 */

/**
 * /start — Memulai proses pemantauan.
 * Bot meminta pengguna memasukkan kata kunci produk.
 */
bot.command('start', async (ctx) => {
  ctx.session.step = 'awaiting_keyword'
  await ctx.reply('Masukkan kata kunci produk (contoh: "vivo v50 12/256")')
})

/**
 * /stop — Menampilkan daftar pemantauan aktif dan meminta user memilih
 * yang ingin dihentikan.
 */
bot.command('stop', async (ctx) => {
  const jobs = listCatalogJobs(ctx.chat.id)

  if (jobs.length === 0) {
    await ctx.reply('⚠️ Tidak ada pantauan aktif.')
    return
  }

  ctx.session.step = 'awaiting_stop_selection'
  ctx.session.keyword = JSON.stringify(jobs) // Simpan sementara daftar pantauan

  const daftarPantauan = jobs
    .map((job, i) => `${i + 1}. <b>${job.keyword}</b> (${job.label})`)
    .join('\n')

  await ctx.reply(
    `Pilih nomor pantauan yang ingin dihentikan:\n${daftarPantauan}`,
    { parse_mode: 'HTML' }
  )
})

/* ============================================================================
 * HANDLER PESAN UMUM (Text)
 * ============================================================================
 */

bot.on(message('text'), async (ctx) => {
  const step = ctx.session.step
  const text = ctx.message.text.trim()

  /* --------------------------------------------------------
   * STEP 1: Meminta kata kunci dari user
   * ------------------------------------------------------ */
  if (step === 'awaiting_keyword') {
    ctx.session.keyword = text
    ctx.session.step = 'awaiting_condition'
    await ctx.reply('Pilih kondisi produk:\n1. Semua\n2. Baru\n3. Bekas')
    return
  }

  /* --------------------------------------------------------
   * STEP 2: User memilih kondisi barang
   * ------------------------------------------------------ */
  if (step === 'awaiting_condition') {
    let source: 'search' | 'universe' = 'search'
    let condition: '1' | '2' | undefined

    switch (text) {
      case '1':
        source = 'search'
        break
      case '2':
        source = 'universe'
        condition = '1'
        break
      case '3':
        source = 'universe'
        condition = '2'
        break
      default:
        await ctx.reply(
          '⚠️ Input tidak valid. Balas dengan angka 1, 2, atau 3.'
        )
        return
    }

    const keyword = ctx.session.keyword || ''
    ctx.session = {} // Reset session

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

  /* --------------------------------------------------------
   * STEP 3: User memilih pantauan yang akan dihentikan
   * ------------------------------------------------------ */
  if (step === 'awaiting_stop_selection') {
    const raw = ctx.session.keyword
    const choice = parseInt(text)

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

    ctx.session = {} // Reset session

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

/* ============================================================================
 * MENJALANKAN BOT
 * ============================================================================
 */

restoreCatalogJobs(bot).then(() => {
  console.log('✅ Semua job dipulihkan. Bot berjalan.')
  bot.launch()
})
