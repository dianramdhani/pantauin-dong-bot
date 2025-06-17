/**
 * Modul ini menangani pembuatan, penyimpanan, dan penghapusan
 * job pemantauan katalog produk berbasis `setInterval`, yang dikirim
 * melalui bot Telegram menggunakan Telegraf.
 *
 * - Jadwal pengiriman dilakukan setiap 6 jam setelah pengiriman pertama.
 * - Job disimpan di memori (non-persisten).
 * - Cocok untuk bot katalog produk seperti marketplace monitor.
 */

import type { Context } from 'telegraf'
import type { InputMediaPhoto } from 'telegraf/types'

import { search } from './api'
import type { Condition, Source } from './types'

/**
 * Struktur job katalog yang dijalankan dengan `setInterval`.
 */
type CatalogJob = {
  interval: NodeJS.Timeout
}

/**
 * Menyimpan semua job katalog yang sedang aktif.
 * Key-nya adalah kombinasi unik berdasarkan `chatId`, `keyword`, `source`, dan `condition`.
 */
const catalogJobs = new Map<string, CatalogJob>()

/**
 * Membuat ID unik untuk job katalog berdasarkan parameter spesifik user.
 *
 * @param chatId ID Telegram user/chat
 * @param keyword Kata kunci pencarian
 * @param source Sumber pencarian (misalnya: 'search' atau 'universe')
 * @param condition Kondisi produk (opsional: '1' untuk baru, '2' untuk bekas)
 * @returns ID unik berbentuk string
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
 * Mengirim katalog produk ke pengguna berdasarkan parameter yang diberikan.
 * Digunakan baik saat pertama kali job dibuat maupun saat interval berikutnya.
 *
 * @param ctx Telegraf context untuk mengakses bot dan chat
 * @param chatId ID Telegram chat
 * @param keyword Kata kunci pencarian
 * @param source Sumber pencarian ('search' atau 'universe')
 * @param condition Kondisi produk (opsional)
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

  // Kirim header informasi
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

  // Kirim maksimal 10 produk dalam bentuk media group
  const mediaGroup: InputMediaPhoto[] = products
    .slice(0, 10)
    .map((product) => ({
      type: 'photo',
      media: product.image,
      caption: `📦 <a href="${product.url}">${product.name}</a>\n💰 <b>${product.price}</b>\n🏬 ${product.shopName} - ${product.shopCity}`,
      parse_mode: 'HTML',
    }))

  await ctx.telegram.sendMediaGroup(chatId, mediaGroup)
}

/**
 * Menjadwalkan pengiriman katalog produk setiap 6 jam setelah pengiriman pertama.
 *
 * @param ctx Telegraf context
 * @param keyword Kata kunci pencarian
 * @param source Sumber pencarian
 * @param condition Kondisi produk (opsional)
 * @returns Status sukses atau alasan kegagalan
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

  // Kirim katalog pertama kali langsung
  await sendCatalog(ctx, chatId, keyword, source, condition)

  // Jadwalkan pengiriman berikutnya setiap 6 jam (6 * 60 * 60 * 1000 ms)
  const interval = setInterval(() => {
    sendCatalog(ctx, chatId, keyword, source, condition)
  }, 6 * 60 * 60 * 1000)

  catalogJobs.set(jobId, { interval })

  return { success: true }
}

/**
 * Mengembalikan daftar job katalog yang sedang aktif untuk sebuah chat tertentu.
 *
 * @param chatId ID Telegram chat
 * @returns Array dari job yang sedang aktif, beserta keyword dan label kondisi
 */
export function listCatalogJobs(
  chatId: number
): { jobId: string; keyword: string; label: string }[] {
  return [...catalogJobs.keys()]
    .filter((key) => key.startsWith(`${chatId}:`))
    .map((key) => {
      const [, keywordEncoded, source, condition] = key.split(':')
      const keyword = decodeURIComponent(keywordEncoded)
      const label =
        source === 'search' ? 'Semua' : condition === '1' ? 'Baru' : 'Bekas'

      return { jobId: key, keyword, label }
    })
}

/**
 * Menghapus dan menghentikan job katalog yang sedang berjalan berdasarkan job ID.
 *
 * @param jobId ID unik job katalog
 * @returns True jika berhasil dihapus, false jika job tidak ditemukan
 */
export function removeCatalogJob(jobId: string): boolean {
  const job = catalogJobs.get(jobId)
  if (!job) return false

  clearInterval(job.interval)
  catalogJobs.delete(jobId)
  return true
}
