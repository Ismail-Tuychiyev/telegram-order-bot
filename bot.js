require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

const userStates = {};

// === 1. Saytdan mahsulotlar keladi ===
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

  bot.sendMessage(chatId, `🛒 Siz quyidagi mahsulotlarni tanladingiz:\n\n${productList}\n\n💰 Jami: ${total.toLocaleString()} so'm\n\n📞 Iltimos, telefon raqamingizni yuboring:`, {
    reply_markup: {
      keyboard: [[{ text: "📞 Telefon raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });

  res.send('✅ Buyurtma qabul qilindi');
});

// === 2. Telefon raqam: tugma orqali ===
bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number;

  if (!userStates[chatId]) return;

  userStates[chatId].phone = phone;
  userStates[chatId].step = 'awaiting_location';

  bot.sendMessage(chatId, '📍 Endi iltimos, manzilingizni lokatsiya orqali yuboring:', {
    reply_markup: {
      keyboard: [[{ text: "📍 Manzilni yuborish", request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// === 3. Telefon raqam: matn orqali ===
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!userStates[chatId]) return;

  // Telefon raqamni oddiy matn sifatida yuborish
  if (userStates[chatId].step === 'awaiting_phone' && /^\+?\d{7,15}$/.test(msg.text)) {
    userStates[chatId].phone = msg.text;
    userStates[chatId].step = 'awaiting_location';

    bot.sendMessage(chatId, '📍 Endi iltimos, manzilingizni lokatsiya orqali yuboring:', {
      reply_markup: {
        keyboard: [[{ text: "📍 Manzilni yuborish", request_location: true }]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  }

  // Sana qabul qilish (agar kerak bo‘lsa)
  if (userStates[chatId].step === 'awaiting_date' && /^\d{4}-\d{2}-\d{2}$/.test(msg.text)) {
    userStates[chatId].date = msg.text;
    userStates[chatId].step = 'awaiting_confirm';

    bot.sendMessage(chatId, '✅ Hammasi tayyormi? Buyurtmani yuboraymi?', {
      reply_markup: {
        inline_keyboard: [[{ text: '🟢 Ha, yuboring', callback_data: 'confirm_order' }]]
      }
    });
  }
});

// === 4. Lokatsiyani qabul qilish ===
bot.on('location', (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (!userStates[chatId]) return;

  userStates[chatId].location = location;
  userStates[chatId].step = 'awaiting_payment';

  bot.sendMessage(chatId, '💳 Qanday to‘lov qilishni xohlaysiz?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: "💵 Naqd", callback_data: "cash" }],
        [{ text: "💳 Karta orqali", callback_data: "card" }]
      ]
    }
  });
});

// === 5. To‘lov turini tanlash va yakuniy xabar ===
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

  // Admin’ga yuborish
  bot.sendMessage(process.env.CHAT_ID, finalMessage, { parse_mode: 'Markdown' });

  // Mijozga tasdiqlovchi xabar
  bot.sendMessage(chatId, '✅ Rahmat! Buyurtmangiz qabul qilindi. Tez orada siz bilan bog‘lanamiz.');

  delete userStates[chatId];
});

app.get('/', (req, res) => res.send('Bot ishga tushdi.'));
app.listen(PORT, () => console.log(`✅ Bot server running on port ${PORT}`));
