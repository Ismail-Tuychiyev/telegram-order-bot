require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const userState = {};

// STEP 1: /start orqali mahsulotlar keladi
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

  bot.sendMessage(chatId, '📍 Iltimos, yetkazib berish manzilingizni lokatsiya orqali yuboring:', {
    reply_markup: {
      keyboard: [[{ text: '📍 Manzilni yuborish', request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// STEP 2: Lokatsiyani qabul qilish
bot.on('location', (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (!userState[chatId]) {
    return bot.sendMessage(chatId, '❌ Buyurtma topilmadi. Iltimos, mahsulotni sayt orqali tanlang.');
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

// STEP 3: Telefon raqamni qabul qilish
bot.on('contact', (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number;

  if (!userState[chatId]) return;

  userState[chatId].phone = phone;
  userState[chatId].step = 'awaiting_date';

  bot.sendMessage(chatId, '📅 Iltimos, yetkazib berish sanasini kiriting (masalan: 2025-06-16):');
});

// STEP 4: Sana qabul qilish
bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (!userState[chatId]) return;

  if (userState[chatId].step === 'awaiting_date' && msg.text && /^\d{4}-\d{2}-\d{2}$/.test(msg.text)) {
    userState[chatId].date = msg.text;
    userState[chatId].step = 'awaiting_confirm';

    bot.sendMessage(chatId, '✅ Buyurtmani yuboraymi?', {
      reply_markup: {
        inline_keyboard: [[{ text: '🟢 Ha, yuboring', callback_data: 'confirm_order' }]]
      }
    });
  }
});

// STEP 5: Buyurtmani tasdiqlash
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
📅 *Sana:* ${data.date}
`;

    // Adminga yuborish
    bot.sendMessage(process.env.CHAT_ID, message, { parse_mode: 'Markdown' });

    // Mijozga xabar
    bot.sendMessage(chatId, '✅ Rahmat! Buyurtmangiz qabul qilindi.');

    delete userState[chatId];
  }
});
