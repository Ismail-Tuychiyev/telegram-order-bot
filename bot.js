require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const userState = {}; // Har bir foydalanuvchi uchun holat

// Saytdan kelgan /start bilan mahsulotlar va total
bot.onText(/\/start (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  let data;

  try {
    data = JSON.parse(decodeURIComponent(match[1]));
  } catch (error) {
    return bot.sendMessage(chatId, "❌ Mahsulotlar noto‘g‘ri yuborilgan.");
  }

  userState[chatId] = {
    products: data.products,
    total: data.total,
    step: "awaiting_location"
  };

  bot.sendMessage(chatId, '📍 Buyurtma qilish uchun manzilingizni yuboring:', {
    reply_markup: {
      keyboard: [[{ text: "📍 Manzilni yuborish", request_location: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// Lokatsiya olganda
bot.on("location", (msg) => {
  const chatId = msg.chat.id;
  const location = msg.location;

  if (!userState[chatId]) return;

  userState[chatId].location = location;
  userState[chatId].step = "awaiting_phone";

  bot.sendMessage(chatId, "📞 Endi telefon raqamingizni yuboring:", {
    reply_markup: {
      keyboard: [[{ text: "📞 Raqamni yuborish", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

// Telefon raqamini olganda
bot.on("contact", (msg) => {
  const chatId = msg.chat.id;
  const phone = msg.contact.phone_number;

  if (!userState[chatId]) return;

  userState[chatId].phone = phone;
  userState[chatId].step = "awaiting_confirm";

  bot.sendMessage(chatId, "✅ Hammasi tayyormi? Quyidagi ma’lumotlarni yuboraymi?", {
    reply_markup: {
      inline_keyboard: [[{ text: "🟢 Ha, yuboring", callback_data: "confirm_order" }]]
    }
  });
});

// Yuborishni tasdiqlaganda
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;

  if (query.data === "confirm_order" && userState[chatId]) {
    const data = userState[chatId];

    const productList = data.products
      .map((item, i) => `${i + 1}. ${item.name} – ${item.price.toLocaleString()} so'm`)
      .join('\n');

    const message = `
📦 *Yangi buyurtma!*
🛒 *Mahsulotlar:*
${productList}

💰 *Jami:* ${data.total.toLocaleString()} so'm
📞 *Telefon:* ${data.phone}
📍 *Manzil:* https://maps.google.com/?q=${data.location.latitude},${data.location.longitude}
`;

    // Sizga yuborish
    bot.sendMessage(process.env.CHAT_ID, message, { parse_mode: 'Markdown' });

    // Mijozga tasdiqlash
    bot.sendMessage(chatId, "✅ Buyurtmangiz yuborildi! Tez orada bog‘lanamiz.");

    delete userState[chatId];
  }
});
