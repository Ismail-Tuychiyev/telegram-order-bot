require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.CHAT_ID;
const PORT = process.env.PORT || 3000;

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const userState = {}; // per-user order tracking

// ======== EXPRESS ENDPOINT (from website) ========
app.post('/send-order', async (req, res) => {
  const { products, total } = req.body;

  const productList = products.map((item, i) =>
    `${i + 1}. ${item.name} – ${item.price.toLocaleString()} so'm`
  ).join('\n');

  const message = `
🛒 <b>Salom! Siz shu mahsulotni harid qilmoqdasiz.</b>

${productList}

💰 <b>Jami:</b> ${total.toLocaleString()} so'm

📍 Iltimos, bizga qayerga mahsulotni yetkazib berish kerakligini GEO lokatsiya orqali bering.`;

  try {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    res.status(200).send('Order sent to Telegram');
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).send('Failed to send message to Telegram');
  }
});

// ======== TELEGRAM BOT ========

// Handle /start WITHOUT data
bot.onText(/^\/start$/, (msg) => {
  bot.sendMessage(msg.chat.id, '❌ Buyurtma yo‘q. Iltimos, mahsulotni sayt orqali tanlang.');
});

// Handle /start WITH data
bot.onText(/^\/start (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  let data;

  try {
    data = JSON.parse(decodeURIComponent(match[1]));
  } catch (error) {
    return bot.sendMessage(chatId, '❌ Buyurtma ma’lumotlari noto‘g‘ri yuborilgan.');
  }

  // Save user data
  userState[chatId] = {
    products: data.products,
    total: data.total,
    step: 'awaiting_location'
  };

  bot.sendMessage(chatId, '📍 Buyurtma qilish uchun manzilingizni yuboring:', {
    reply_markup: {
      keyboard: [[{ text: '📍 Manzilni yuborish', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

bot.on('location', (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (!userState[chatId]) {
    return bot.sendMessage(chatId, '❌ Buyurtma ma’lumotlari yo‘q. Iltimos, mahsulotni sayt orqali tanlang.');
  }

  userState[chatId].location = location;
  userState[chatId].step = 'awaiting_phone';

  bot.sendMessage(chatId, '📞 Endi telefon raqamingizni yuboring:', {
    reply_markup: {
      keyboard: [[{ text: '📞 Raqamni yuborish', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number;

  if (!userState[chatId]) {
    return bot.sendMessage(chatId, '❌ Buyurtma ma’lumotlari yo‘q.');
  }

  userState[chatId].phone = phone;
  userState[chatId].step = 'awaiting_confirm';

  bot.sendMessage(chatId, '✅ Hammasi tayyormi? Quyidagi ma’lumotlarni yuboraymi?', {
    reply_markup: {
      inline_keyboard: [[{ text: '🟢 Ha, yuboring', callback_data: 'confirm_order' }]]
    }
  });
});

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'confirm_order' && userState[chatId]) {
    const data = userState[chatId];

    const productList = data.products.map((item, i) =>
      `${i + 1}. ${item.name} – ${item.price.toLocaleString()} so'm`
    ).join('\n');

    const message = `
📦 *Yangi buyurtma!*
🛒 *Mahsulotlar:*
${productList}

💰 *Jami:* ${data.total.toLocaleString()} so'm
📞 *Telefon:* ${data.phone}
📍 *Manzil:* [Lokatsiya](https://maps.google.com/?q=${data.location.latitude},${data.location.longitude})`;

    bot.sendMessage(process.env.CHAT_ID, message, { parse_mode: 'Markdown' });
    bot.sendMessage(chatId, '✅ Buyurtmangiz yuborildi! Tez orada bog‘lanamiz.');

    delete userState[chatId]; // clear memory
  }
});

// ======== START SERVER ========
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
