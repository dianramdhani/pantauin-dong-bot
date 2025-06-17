import { CronJob } from 'cron'
import type { Context } from 'telegraf'
import type { InputMediaPhoto } from 'telegraf/types'

import { search } from './api.ts'
import type { Condition, Source } from './types.ts'

// Menyimpan semua job katalog berdasarkan ID unik
const catalogJobs = new Map<string, CronJob>()

// Membuat ID unik berdasarkan kombinasi chatId, keyword, source, dan condition
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

// Jadwalkan pengiriman katalog tiap 6 jam
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

  // ⏰ Jadwal: Setiap 6 jam sekali ('0 */6 * * *')
  const job = new CronJob('0 */6 * * *', async () => {
    const label =
      source === 'search' ? 'Semua' : condition === '1' ? 'Baru' : 'Bekas'

    // Kirim header info katalog
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

    // Kirim media group (maks. 10 produk)
    const mediaGroup: InputMediaPhoto[] = products
      .slice(0, 10)
      .map((product) => ({
        type: 'photo',
        media: product.image,
        caption: `📦 <a href="${product.url}">${product.name}</a>\n💰 <b>${product.price}</b>\n🏬 ${product.shopName} - ${product.shopCity}`,
        parse_mode: 'HTML',
      }))

    await ctx.telegram.sendMediaGroup(chatId, mediaGroup)
  })

  job.start()
  catalogJobs.set(jobId, job)

  return { success: true }
}

// Menampilkan daftar pantauan aktif berdasarkan chatId
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

// Menghapus job berdasarkan ID
export function removeCatalogJob(jobId: string): boolean {
  const job = catalogJobs.get(jobId)
  if (!job) return false

  job.stop()
  catalogJobs.delete(jobId)
  return true
}
