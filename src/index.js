import { Telegraf } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Константы и утилиты ---
const ALLOWED = new Set(["en", "ru", "fr", "de"]);
const LT_ENDPOINTS = [
  "https://libretranslate.de/translate",
  "https://translate.argosopentech.com/translate",
  "https://libretranslate.com/translate",
];

function detectLangSimple(text) {
  if (/[А-Яа-яЁё]/.test(text)) return "ru";
  if (/[A-Za-z]/.test(text)) return "en";
  return "en";
}

const LANG_BUTTONS = [
  [{ text: "🇬🇧 English", callback_data: "en" }, { text: "🇷🇺 Russian", callback_data: "ru" }],
  [{ text: "🇫🇷 French",  callback_data: "fr" }, { text: "🇩🇪 German",  callback_data: "de" }],
];

// --- Команды / UI ---
const userTargetLang = new Map(); // userId -> target lang

bot.start((ctx) => {
  userTargetLang.set(ctx.from.id, "en");
  ctx.reply(
    "👋 Привет! Я бот-переводчик. Отправь текст — переведу на 🇬🇧 английский.\n\n" +
      "🌐 Чтобы выбрать другой язык, нажми кнопку ниже:",
    { reply_markup: { inline_keyboard: LANG_BUTTONS } }
  );
});

bot.command("lang", (ctx) => {
  ctx.reply("🌐 Выбери язык перевода:", { reply_markup: { inline_keyboard: LANG_BUTTONS } });
});

bot.on("callback_query", async (ctx) => {
  const lang = (ctx.callbackQuery?.data || "").toLowerCase();
  if (ALLOWED.has(lang)) {
    userTargetLang.set(ctx.from.id, lang);
    await ctx.answerCbQuery(`Язык: ${lang.toUpperCase()}`);
    await ctx.reply(`✅ Язык перевода установлен: ${lang.toUpperCase()}`);
  } else {
    await ctx.answerCbQuery("Неизвестный язык", { show_alert: true });
  }
});

// Альтернативные короткие команды (на всякий случай)
for (const code of ALLOWED) {
  bot.command(code, (ctx) => {
    userTargetLang.set(ctx.from.id, code);
    ctx.reply(`✅ Язык перевода: ${code.toUpperCase()}`);
  });
}

// --- Переводчики ---
async function translateViaLibreTranslate(text, src, tgt) {
  for (const url of LT_ENDPOINTS) {
    try {
      const r = await axios.post(
        url,
        { q: text, source: src, target: tgt, format: "text" },
        { headers: { accept: "application/json", "content-type": "application/json" }, timeout: 15000 }
      );
      if (r.data?.translatedText) return r.data.translatedText;
    } catch (e) {
      console.error(`LT fail ${url}:`, e?.response?.status, e?.response?.data || e?.message);
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return null;
}

async function translateViaMyMemory(text, src, tgt) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text
    )}&langpair=${src}|${tgt}`;
    const r = await axios.get(url, { timeout: 15000 });

    let best = r.data?.responseData?.translatedText;
    const matches = Array.isArray(r.data?.matches) ? r.data.matches : [];
    const better = matches
      .filter((m) => m?.translation && m.translation.toLowerCase() !== text.toLowerCase())
      .sort((a, b) => (b.match || 0) - (a.match || 0))[0];
    if (better?.translation) best = better.translation;

    return best || null;
  } catch (e) {
    console.error("MyMemory fail:", e?.response?.status, e?.response?.data || e?.message);
    return null;
  }
}

// --- Основной обработчик текста (один, без дублей) ---
bot.on("text", async (ctx) => {
  const text = ctx.message.text?.trim();
  if (!text) return;

  // целевой язык пользователя с безопасным дефолтом
  let target = (userTargetLang.get(ctx.from.id) || "en").toLowerCase();
  if (!ALLOWED.has(target)) target = "en";

  let source = detectLangSimple(text);
  if (!ALLOWED.has(source)) source = "en";

  if (source === target) {
    await ctx.reply("🤖 Текст уже на выбранном языке — перевода не требуется. Сменить язык: /lang");
    return;
  }

  try {
    let translated = await translateViaLibreTranslate(text, source, target);
    if (!translated) translated = await translateViaMyMemory(text, source, target);

    if (translated) {
      await ctx.reply(`🌐 Перевод (${target.toUpperCase()}):\n${translated}`);
    } else {
      await ctx.reply("⚠️ Не удалось получить перевод. Попробуй позже.");
    }
  } catch (e) {
    console.error("Translate handler error:", e?.message || e);
    await ctx.reply("⚠️ Техническая ошибка. Попробуй ещё раз.");
  }
});

// --- Запуск: webhook 
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN; // пример: https://di-translator-bot.onrender.com
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    if (WEBHOOK_DOMAIN) {
      // Режим WEBHOOK
      const app = express();
      app.use(express.json());

      // Секретный путь, чтобы нельзя было «подобрать» адрес
      const secretPath = `/bot${process.env.BOT_TOKEN}`; 
        // Явно регистрируем ровно этот путь как POST-хук
      app.post(secretPath, (req, res) => {
        // важно: передаём res — Telegraf сам ответит 200
        bot.handleUpdate(req.body, res);
      });

      // health-check для Render
      app.get("/", (_, res) => res.status(200).send("OK"));


      // Сообщаем Telegram куда слать апдейты
      await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${secretPath}`);
      console.log(`🌐 Webhook set to: ${WEBHOOK_DOMAIN}${secretPath}`);

      app.listen(PORT, () =>
        console.log(`✅ Webhook mode is listening on ${PORT}`)
      );
    } else {
      // локально
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch();
      console.log("✅ Polling mode:", new Date().toLocaleString());
    }
      } catch (e) {
        console.error("🚫 Ошибка запуска:", e.message);
      }
    })();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

