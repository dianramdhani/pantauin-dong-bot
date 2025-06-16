import { CronJob } from 'cron'
import { parse, subMinutes, isBefore, addDays } from 'date-fns'
import { checkOut, getAddressId, login } from './api.ts'
import { Telegraf } from 'telegraf'
import { AxiosError } from 'axios'

type Schedule = {
  email: string
  checkoutTime: string // 'HH:mm',
  token?: string
  addressId?: number
  loginJob: CronJob
  checkoutJob: CronJob
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)
const userSchedules = new Map<number, Schedule>()

export function scheduleCheckout({
  userId,
  email,
  time,
}: {
  userId: number
  email: string
  time: string
}) {
  const now = new Date()
  let target = parse(time, 'HH:mm', now)
  let loginTime = subMinutes(target, 1)

  // Jika waktu target sudah lewat hari ini, jadwalkan untuk besok
  if (isBefore(target, now)) {
    target = addDays(target, 1)
    loginTime = addDays(loginTime, 1)
  }

  // Jika sudah ada jadwal lama, hentikan dulu
  const existing = userSchedules.get(userId)
  if (existing) {
    existing.loginJob.stop()
    existing.checkoutJob.stop()
    userSchedules.delete(userId)
  }

  const loginJob = new CronJob(loginTime, async () => {
    try {
      console.log(
        `🔐 [${email}] Login dulu jam ${loginTime.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      )

      const token = await login(email)
      const addressId = await getAddressId(token)

      const schedule = userSchedules.get(userId)
      if (schedule) {
        schedule.token = token
        schedule.addressId = addressId
      }

      await bot.telegram.sendMessage(userId, `✅ [${email}] Sukses login`)
    } catch (err) {
      console.error(`❌ [${email}] Gagal login:`, err)
      if (err instanceof AxiosError) {
        await bot.telegram.sendMessage(
          userId,
          `❌ [${email}] Gagal login: ${err.message}`
        )
      }
    }
  })

  const checkoutJob = new CronJob(target, async () => {
    try {
      console.log(
        `🛒 [${email}] Checkout sekarang jam ${target.toLocaleTimeString(
          'id-ID',
          {
            hour: '2-digit',
            minute: '2-digit',
          }
        )}`
      )

      const schedule = userSchedules.get(userId)
      if (!schedule?.token || !schedule?.addressId) {
        console.warn(`⚠️ [${email}] Token atau addressId tidak ditemukan.`)
        await bot.telegram.sendMessage(
          userId,
          `⚠️ [${email}] Token atau addressId tidak ditemukan.`
        )
        return
      }

      const startTime = new Date().getTime()
      for (let i = 0; i < 10; i++) {
        const isSuccess = await checkOut({
          addressId: schedule.addressId,
          token: schedule.token,
        })
        if (isSuccess) {
          const endTime = new Date().getTime()
          await bot.telegram.sendMessage(
            userId,
            `✅ [${email}] Success checkout dalam waktu ${
              endTime - startTime
            }ms`
          )
          break
        }
      }
    } catch (err) {
      console.error(`❌ [${email}] Gagal checkout:`, err)
      if (err instanceof AxiosError) {
        await bot.telegram.sendMessage(
          userId,
          `❌ [${email}] Gagal checkout: ${err.message}`
        )
      }
    } finally {
      loginJob.stop()
      checkoutJob.stop()
      userSchedules.delete(userId)
    }
  })

  loginJob.start()
  checkoutJob.start()

  const schedule: Schedule = {
    email,
    checkoutTime: time,
    loginJob,
    checkoutJob,
  }

  userSchedules.set(userId, schedule)
}
