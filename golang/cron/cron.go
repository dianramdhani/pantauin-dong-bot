package cron

import (
	"fmt"
	"log"
	"sync"
	"time"

	"jtdc-co/api"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/robfig/cron/v3"
)

type Schedule struct {
	Email        string
	CheckoutTime string // "HH:mm"
	Token        string
	AddressID    int
	LoginID      cron.EntryID
	CheckoutID   cron.EntryID
}

var (
	schedules     = make(map[int64]*Schedule)
	schedLock     = sync.Mutex{}
	cronScheduler = cron.New()
	bot           *tgbotapi.BotAPI
)

func Init(botInstance *tgbotapi.BotAPI) {
	bot = botInstance
	cronScheduler.Start()
}

func ScheduleCheckout(userID int64, email string, timeStr string) error {
	schedLock.Lock()
	defer schedLock.Unlock()

	now := time.Now()
	target, err := time.ParseInLocation("15:04", timeStr, now.Location())
	if err != nil {
		return fmt.Errorf("format waktu salah: %w", err)
	}
	// Gabungkan jam dan menit dari target dengan tanggal hari ini
	targetTime := time.Date(now.Year(), now.Month(), now.Day(), target.Hour(), target.Minute(), 0, 0, now.Location())
	loginTime := targetTime.Add(-1 * time.Minute)

	// Jika waktu sudah lewat, jadwalkan besok
	if targetTime.Before(now) {
		targetTime = targetTime.Add(24 * time.Hour)
		loginTime = loginTime.Add(24 * time.Hour)
	}

	// Stop jadwal lama jika ada
	if existing, ok := schedules[userID]; ok {
		cronScheduler.Remove(existing.LoginID)
		cronScheduler.Remove(existing.CheckoutID)
		delete(schedules, userID)
	}

	// Jadwalkan login
	loginID, err := cronScheduler.AddFunc(buildSpec(loginTime), func() {
		log.Printf("🔐 [%s] Login untuk user %d\n", email, userID)
		token, err := api.Login(email)
		if err != nil {
			log.Println("Login error:", err)
			bot.Send(tgbotapi.NewMessage(userID, fmt.Sprintf("❌ [%s] Gagal login: %v", email, err)))
			return
		}
		addressID, err := api.GetAddressID(token)
		if err != nil {
			log.Println("Address error:", err)
			bot.Send(tgbotapi.NewMessage(userID, fmt.Sprintf("❌ [%s] Gagal ambil addressId: %v", email, err)))
			return
		}
		schedLock.Lock()
		if s, ok := schedules[userID]; ok {
			s.Token = token
			s.AddressID = addressID
		}
		schedLock.Unlock()
		bot.Send(tgbotapi.NewMessage(userID, fmt.Sprintf("✅ [%s] Sukses login", email)))
	})
	if err != nil {
		return err
	}

	// Jadwalkan checkout
	checkoutID, err := cronScheduler.AddFunc(buildSpec(targetTime), func() {
		log.Printf("🛒 [%s] Checkout untuk user %d\n", email, userID)
		schedLock.Lock()
		s := schedules[userID]
		schedLock.Unlock()

		if s == nil || s.Token == "" || s.AddressID == 0 {
			bot.Send(tgbotapi.NewMessage(userID, fmt.Sprintf("⚠️ [%s] Token atau addressId tidak ditemukan.", email)))
			return
		}

		start := time.Now()
		for range 10 {
			success, _ := api.CheckOut(s.AddressID, s.Token)
			if success {
				duration := time.Since(start)
				bot.Send(tgbotapi.NewMessage(userID, fmt.Sprintf("✅ [%s] Berhasil checkout dalam %dms", email, duration.Milliseconds())))
				break
			}
		}

		// Hapus jadwal setelah selesai
		schedLock.Lock()
		cronScheduler.Remove(s.LoginID)
		cronScheduler.Remove(s.CheckoutID)
		delete(schedules, userID)
		schedLock.Unlock()
	})
	if err != nil {
		return err
	}

	schedules[userID] = &Schedule{
		Email:        email,
		CheckoutTime: timeStr,
		LoginID:      loginID,
		CheckoutID:   checkoutID,
	}

	return nil
}

func buildSpec(t time.Time) string {
	// Format untuk robfig cron: "MIN HOUR DOM MON DOW"
	return fmt.Sprintf("%d %d %d %d *", t.Minute(), t.Hour(), t.Day(), int(t.Month()))
}
