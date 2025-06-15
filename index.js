// ==== index.js (Express Server) ====
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.CHAT_ID;

app.post('/send-order', async (req, res) => {
  const { products, total, name, phone, address, date, location, payment } = req.body;

  if (!products || !name || !phone || !address || !date || !location || !payment) {
    return res.status(400).send("❌ Kerakli ma'lumotlar to‘liq emas.");
  }

  const productList = products.map((item, i) =>
    `${i + 1}. ${item.name} – ${item.price.toLocaleString()} so'm`
  ).join('\n');

  const message = `
📦 <b>Yangi buyurtma!</b>
🛒 <b>Mahsulotlar:</b>
${productList}

💰 <b>Jami:</b> ${total.toLocaleString()} so'm
👤 <b>Ism:</b> ${name}
📞 <b>Telefon:</b> ${phone}
🏠 <b>Manzil:</b> ${address}
📍 <b>Lokatsiya:</b> <a href="${location}">Xaritada ko‘rish</a>
💳 <b>To‘lov:</b> ${payment}
📅 <b>Sana:</b> ${date}
`;

  try {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    res.send('✅ Buyurtma Telegramga yuborildi');
  } catch (err) {
    console.error("❌ Telegramga yuborishda xatolik:", err);
    res.status(500).send('❌ Xatolik yuz berdi');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});


// ==== bot.js (optional for /start flow) ====
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const userState = {}; // foydalanuvchi uchun session

bot.onText(/\/start (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  let data;

  try {
    data = JSON.parse(decodeURIComponent(match[1]));
  } catch (error) {
    return bot.sendMessage(chatId, '❌ Buyurtma ma’lumotlari noto‘g‘ri yuborilgan.');
  }

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

  if (!userState[chatId]) return;

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

    const productList = data.products.map((item, i) => `${i + 1}. ${item.name} – ${item.price.toLocaleString()} so'm`).join('\n');

    const message = `
📦 *Yangi buyurtma!*
🛒 *Mahsulotlar:*
${productList}

💰 *Jami:* ${data.total.toLocaleString()} so'm
📞 *Telefon:* ${data.phone}
📍 *Manzil:* https://maps.google.com/?q=${data.location.latitude},${data.location.longitude}
`;

    bot.sendMessage(process.env.CHAT_ID, message, { parse_mode: 'Markdown' });
    bot.sendMessage(chatId, '✅ Buyurtmangiz yuborildi! Tez orada bog‘lanamiz.');

    delete userState[chatId];
  }
});
