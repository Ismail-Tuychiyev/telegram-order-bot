require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;
app.use(bodyParser.json());

const userStates = {}; // har bir user uchun session

// 1. Saytdan kelgan buyurtma
app.post('/send-order', (req, res) => {
  const { products, total, chatId } = req.body;

  if (!products || !total || !chatId) {
    return res.status(400).send('❌ Noto‘g‘ri ma’lumot');
  }

  userStates[chatId] = {
    products,
    total,
    step: 'awaiting_phone'
  };

  const productList = products.map((p, i) => `${i + 1}. ${p.name} – ${p.price.toLocaleString()} so'm`).join('\n');

  bot.sendMessage(chatId, `🛒 Siz quyidagi mahsulotlarni tanladingiz:\n\n${productList}\n\n💰 Jami: ${total.toLocaleString()} so'm\n\n📞 Endi iltimos, telefon raqamingizni yuboring:`, {
    reply_markup: {
      keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });

  res.send('✅ Bot ishga tushdi');
});

// 2. Telefon raqamini qabul qilish
bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number;

  if (!userStates[chatId]) return;

  userStates[chatId].phone = phone;
  userStates[chatId].step = 'awaiting_location';

  bot.sendMessage(chatId, '📍 Iltimos, lokatsiyangizni yuboring:', {
    reply_markup: {
      keyboard: [[{ text: "📍 Manzilni yuborish", request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// 3. Lokatsiyani qabul qilish
bot.on('location', (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (!userStates[chatId]) return;

  userStates[chatId].location = location;
  userStates[chatId].step = 'awaiting_payment';

  bot.sendMessage(chatId, '💳 Qanday to‘lashni xohlaysiz?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💵 Naqd", callback_data: "cash" }],
        [{ text: "💳 Karta orqali", callback_data: "card" }]
      ]
    }
  });
});

// 4. To‘lov turini qabul qilish va ADMINga yuborish
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const paymentType = query.data;

  if (!userStates[chatId]) return;

  const data = userStates[chatId];
  const productList = data.products.map((p, i) => `${i + 1}. ${p.name} – ${p.price.toLocaleString()} so'm`).join('\n');
  const locationUrl = `https://maps.google.com/?q=${data.location.latitude},${data.location.longitude}`;

  const finalMessage = `
📦 *Yangi Buyurtma!*

🛒 *Mahsulotlar:*
${productList}

💰 *Jami:* ${data.total.toLocaleString()} so'm
📞 *Telefon:* ${data.phone}
📍 *Manzil:* [Google Maps](${locationUrl})
💳 *To‘lov turi:* ${paymentType === 'cash' ? 'Naqd' : 'Karta'}
`;

  // 1. Admin’ga yuboriladi
  bot.sendMessage(process.env.CHAT_ID, finalMessage, { parse_mode: 'Markdown' });

  // 2. Mijozga tasdiq
  bot.sendMessage(chatId, '✅ Rahmat! Buyurtmangiz qabul qilindi. Tez orada siz bilan bog‘lanamiz.');

  delete userStates[chatId];
});

app.get('/', (req, res) => res.send('Bot ishlayapti!'));
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
