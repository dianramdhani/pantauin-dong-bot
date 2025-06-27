/**
 * catalogScheduler.ts
 * --------------------
 * Modul ini bertanggung jawab untuk menjadwalkan, mengelola, dan memulihkan
 * job pemantauan katalog produk berbasis interval menggunakan bot Telegram.
 *
 * Fitur utama:
 * - Pengiriman katalog dilakukan setiap 6 jam setelah pengiriman pertama.
 * - Semua job disimpan di file `catalog-jobs.json` agar tetap aktif setelah restart.
 * - Mendukung banyak job dari berbagai pengguna sekaligus.
 */

import type { Context, Telegraf } from 'telegraf'
import type { InputMediaPhoto } from 'telegraf/types'
import type { Condition, Source } from './types'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import { search } from './api'

/* ============================================================================
 * KONSTANTA & TIPE DATA
 * ============================================================================
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FILE_PATH = path.join(__dirname, 'catalog-jobs.json')
const SIX_HOURS = 6 * 60 * 60 * 1000

type CatalogJob = {
  interval: NodeJS.Timeout
}

type JobData = {
  chatId: number
  keyword: string
  source: Source
  condition?: Condition
  createdAt: number
}

/**
 * Map untuk menyimpan semua job aktif dalam memori.
 */
const catalogJobs = new Map<string, CatalogJob>()

/* ============================================================================
 * UTILITAS
 * ============================================================================
 */

/**
 * Membuat ID unik untuk setiap job berdasarkan kombinasi data pengguna.
 */
function getJobId(
  chatId: number,
  keyword: string,
  source: Source,
  condition?: Condition
): string {
  return `${chatId}:${encodeURIComponent(keyword)}:${source}:${
    condition || 'all'
  }`
}

/**
 * Membaca seluruh job dari file `catalog-jobs.json`.
 */
function loadJobsFromDisk(): JobData[] {
  if (!fs.existsSync(FILE_PATH)) return []
  try {
    const data = fs.readFileSync(FILE_PATH, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

/**
 * Menyimpan seluruh job ke file `catalog-jobs.json`.
 */
function saveJobsToDisk(jobs: JobData[]) {
  fs.writeFileSync(FILE_PATH, JSON.stringify(jobs, null, 2))
}

/**
 * Menambahkan satu job ke file.
 */
function saveJobToDisk(job: JobData) {
  const jobs = loadJobsFromDisk()
  jobs.push(job)
  saveJobsToDisk(jobs)
}

/**
 * Menghapus satu job dari file berdasarkan jobId.
 */
function removeJobFromDisk(jobId: string) {
  const jobs = loadJobsFromDisk()
  const filtered = jobs.filter((j) => {
    const id = getJobId(j.chatId, j.keyword, j.source, j.condition)
    return id !== jobId
  })
  saveJobsToDisk(filtered)
}

/* ============================================================================
 * FUNGSI UTAMA
 * ============================================================================
 */

/**
 * Mengirim katalog produk berdasarkan parameter yang diberikan.
 */
async function sendCatalog(
  ctx: Context,
  chatId: number,
  keyword: string,
  source: Source,
  condition?: Condition
) {
  const label =
    source === 'search' ? 'Semua' : condition === '1' ? 'Baru' : 'Bekas'

  await ctx.telegram.sendMessage(
    chatId,
    `📢 Update katalog untuk:\n🔍 <b>${keyword}</b>\n🛒 Kondisi: <b>${label}</b>`,
    { parse_mode: 'HTML' }
  )

  const products = await search({ q: keyword, source, condition })

  if (products.length === 0) {
    await ctx.telegram.sendMessage(
      chatId,
      `📭 Tidak ditemukan hasil untuk <b>${keyword}</b> (${label})`,
      { parse_mode: 'HTML' }
    )
    return
  }

  const mediaGroup: InputMediaPhoto[] = products.slice(0, 10).map((p) => ({
    type: 'photo',
    media: p.image,
    caption: `📦 <a href="${p.url}">${p.name}</a>\n💰 <b>${p.price}</b>\n🏬 ${p.shopName} - ${p.shopCity}`,
    parse_mode: 'HTML',
  }))

  await ctx.telegram.sendMediaGroup(chatId, mediaGroup)
}

/**
 * Menjadwalkan katalog baru yang akan dikirim setiap 6 jam.
 *
 * @returns objek `{ success: boolean, reason?: string }`
 */
export async function scheduleCatalogJob(
  ctx: Context,
  keyword: string,
  source: Source,
  condition?: Condition
): Promise<{ success: boolean; reason?: string }> {
  const chatId = ctx.chat?.id
  if (!chatId) return { success: false, reason: 'Chat ID not found' }

  const jobId = getJobId(chatId, keyword, source, condition)
  if (catalogJobs.has(jobId)) {
    return { success: false, reason: 'Job already exists' }
  }

  // Kirim katalog pertama langsung
  await sendCatalog(ctx, chatId, keyword, source, condition)

  const interval = setInterval(() => {
    sendCatalog(ctx, chatId, keyword, source, condition)
  }, SIX_HOURS)

  catalogJobs.set(jobId, { interval })
  saveJobToDisk({ chatId, keyword, source, condition, createdAt: Date.now() })

  return { success: true }
}

/**
 * Menghapus job berdasarkan jobId dan menghentikan interval-nya.
 */
export function removeCatalogJob(jobId: string): boolean {
  const job = catalogJobs.get(jobId)
  if (!job) return false

  clearInterval(job.interval)
  catalogJobs.delete(jobId)
  removeJobFromDisk(jobId)
  return true
}

/**
 * Mengembalikan semua job yang dimiliki oleh satu pengguna/chat.
 */
export function listCatalogJobs(
  chatId: number
): { jobId: string; keyword: string; label: string }[] {
  const jobs = loadJobsFromDisk()
  return jobs
    .filter((job) => job.chatId === chatId)
    .map((job) => {
      const jobId = getJobId(job.chatId, job.keyword, job.source, job.condition)
      const label =
        job.source === 'search'
          ? 'Semua'
          : job.condition === '1'
          ? 'Baru'
          : 'Bekas'
      return { jobId, keyword: job.keyword, label }
    })
}

/**
 * Fungsi ini harus dipanggil sekali saat bot dijalankan,
 * agar semua job yang sebelumnya disimpan di file dijalankan kembali.
 */
export async function restoreCatalogJobs(bot: Telegraf<Context>) {
  const jobs = loadJobsFromDisk()

  for (const job of jobs) {
    const jobId = getJobId(job.chatId, job.keyword, job.source, job.condition)
    if (catalogJobs.has(jobId)) continue

    const delay = Math.max(0, SIX_HOURS - (Date.now() - job.createdAt))

    setTimeout(() => {
      // Kirim katalog lalu mulai interval
      sendCatalog(
        { telegram: bot.telegram } as Context,
        job.chatId,
        job.keyword,
        job.source,
        job.condition
      )

      const interval = setInterval(() => {
        sendCatalog(
          { telegram: bot.telegram } as Context,
          job.chatId,
          job.keyword,
          job.source,
          job.condition
        )
      }, SIX_HOURS)

      catalogJobs.set(jobId, { interval })
    }, delay)
  }
}
