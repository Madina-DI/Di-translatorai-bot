# 🤖 DI Translator AI Bot

A Telegram bot that translates text using AI.  
Built with **Node.js** and **Telegraf**, supports both **polling** and **webhook** modes.

---

## 🚀 Features

- 🌐 Translates user messages automatically  
- 🔁 Supports polling and webhook connection  
- ⚙️ Simple configuration via `.env`  
- 📦 Lightweight and ready to deploy on Render or similar platforms  

---

## 🧩 Tech Stack

- Node.js  
- Telegraf (Telegram Bot API)  
- dotenv  
- Express (for webhook mode)  

---

## 🛠️ Setup & Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Madina-DI/Di-translatorai-bot.git
   cd Di-translatorai-bot
2. Install dependencies

npm install


3. Create a .env file

BOT_TOKEN=your_telegram_bot_token
WEBHOOK_DOMAIN=https://your-app.onrender.com


4. Run in local (polling) mode

node src/index.js


5. Run with webhook (for production)
Make sure your server has HTTPS enabled, then set webhook in your code or via:

https://api.telegram.org/bot<your_token>/setWebhook?url=<your_domain>/bot

🧪 Example .env.example

BOT_TOKEN=PASTE_YOUR_TOKEN_HERE
WEBHOOK_DOMAIN=https://YOUR_APP.onrender.com

📄 Scripts

npm start — start the bot
npm run dev — start with nodemon (if installed)

📚 Folder Structure

di-translatorai-bot/
│
├── src/
│   ├── index.js        # entry point
│   ├── translate.js    # translation logic
│
├── .env.example
├── .gitignore
├── package.json
├── README.md