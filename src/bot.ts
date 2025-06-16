import { Context, session, Telegraf } from 'telegraf'
import type { InputMediaPhoto } from 'telegraf/types'
import { search } from './api.ts'
import { message } from 'telegraf/filters'

type SessionData = {
  step?: 'awaiting_keyword' | 'awaiting_condition'
  keyword?: string
}

interface MyContext extends Context {
  session: SessionData
}

const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_TOKEN || '')
bot.use(session({ defaultSession: () => ({}) }))

bot.command('katalog', async (ctx) => {
  ctx.session.step = 'awaiting_keyword'
  await ctx.reply(
    'Masukkan kata kunci pencarian produk (contoh: "vivo v50 12/256")'
  )
})

bot.on(message('text'), async (ctx) => {
  const step = ctx.session.step

  if (step === 'awaiting_keyword') {
    ctx.session.keyword = ctx.message.text
    ctx.session.step = 'awaiting_condition'
    await ctx.reply('Pilih kondisi produk:\n1. Semua\n2. Baru\n3. Bekas')
  } else if (step === 'awaiting_condition') {
    const conditionChoice = ctx.message.text.trim()
    let source: 'search' | 'universe' = 'search'
    let condition: '1' | '2' | undefined

    if (conditionChoice === '1') {
      source = 'search'
      condition = undefined
    } else if (conditionChoice === '2') {
      source = 'universe'
      condition = '1'
    } else if (conditionChoice === '3') {
      source = 'universe'
      condition = '2'
    } else {
      await ctx.reply('Input tidak valid. Balas dengan angka 1, 2, atau 3.')
      return
    }

    const keyword = ctx.session.keyword || ''
    ctx.session = {} // reset sesi

    const products = await search({ q: keyword, source, condition })

    if (products.length === 0) {
      await ctx.reply('Produk tidak ditemukan.')
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
  }
})

bot.launch()
