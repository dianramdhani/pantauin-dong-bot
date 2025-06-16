package main

import (
	"fmt"
	"jtdc-co/cron"
	"log"
	"os"
	"regexp"
	"strings"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/joho/godotenv"
)

type UserState struct {
	Stage string // "email" atau "time"
	Email string
}

var userStates = make(map[int64]*UserState)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
var timeRegex = regexp.MustCompile(`^([01]?\d|2[0-3]):([0-5]\d)$`)

func init() {
	_ = godotenv.Load(".env")
}

func main() {
	bot, err := tgbotapi.NewBotAPI(os.Getenv("TELEGRAM_BOT_TOKEN"))
	if err != nil {
		log.Fatalf("failed to create bot: %v", err)
	}

	bot.Debug = false
	log.Printf("Authorized on account %s", bot.Self.UserName)

	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60

	updates := bot.GetUpdatesChan(u)
	cron.Init(bot)

	for update := range updates {
		if update.Message == nil { // ignore non-message updates
			continue
		}

		userID := update.Message.From.ID
		text := strings.TrimSpace(update.Message.Text)

		switch {
		case text == "/co":
			userStates[userID] = &UserState{Stage: "email"}
			msg := tgbotapi.NewMessage(userID, "Masukkan email Anda:")
			bot.Send(msg)

		case text == "/cancel":
			if _, exists := userStates[userID]; exists {
				delete(userStates, userID)
				bot.Send(tgbotapi.NewMessage(userID, "❌ Input dibatalkan."))
			} else {
				bot.Send(tgbotapi.NewMessage(userID, "Tidak ada proses yang sedang berlangsung."))
			}

		default:
			state, exists := userStates[userID]
			if !exists {
				continue
			}

			if state.Stage == "email" {
				if !emailRegex.MatchString(text) {
					bot.Send(tgbotapi.NewMessage(userID, "Format email tidak valid. Masukkan email yang benar."))
					continue
				}
				state.Email = text
				state.Stage = "time"
				bot.Send(tgbotapi.NewMessage(userID, "Masukkan waktu checkout (format hh:mm):"))
			} else if state.Stage == "time" {
				if !timeRegex.MatchString(text) {
					bot.Send(tgbotapi.NewMessage(userID, "Format tidak valid. Gunakan hh:mm (contoh: 13:45)"))
					continue
				}

				formatted := formatTime(text)
				err := cron.ScheduleCheckout(userID, state.Email, formatted)
				if err != nil {
					log.Println("Gagal menjadwalkan checkout:", err)
					bot.Send(tgbotapi.NewMessage(userID, "❌ Gagal menjadwalkan checkout. Silakan coba lagi."))
				} else {
					bot.Send(tgbotapi.NewMessage(userID,
						fmt.Sprintf("✅ Checkout dijadwalkan pukul %s untuk email %s", formatted, state.Email)))
				}

				delete(userStates, userID)
			}
		}
	}
}

func formatTime(input string) string {
	parts := strings.Split(input, ":")
	hour := fmt.Sprintf("%02s", parts[0])
	minute := fmt.Sprintf("%02s", parts[1])
	return hour + ":" + minute
}
