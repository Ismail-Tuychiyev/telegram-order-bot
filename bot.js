
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const userState = {}; // stores order progress per user

// STEP 1: Handle /start from frontend with encoded cart
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

// STEP 2: Receive location
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

// STEP 3: Receive phone number
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

// STEP 4: Confirm and send order to admin
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

    // Send to you (admin)
    bot.sendMessage(process.env.CHAT_ID, message, { parse_mode: 'Markdown' });

    // Confirm to buyer
    bot.sendMessage(chatId, '✅ Buyurtmangiz yuborildi! Tez orada bog‘lanamiz.');

    delete userState[chatId];
  }
});
