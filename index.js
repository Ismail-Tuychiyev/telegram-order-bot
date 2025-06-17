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
  `${i + 1}. ${item.name} (${item.code || 'no-code'}) – ${item.price.toLocaleString()} so'm`
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
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });

    res.send('✅ Buyurtma Telegramga yuborildi');
  } catch (error) {
    console.error("❌ Telegramga yuborishda xatolik:", error);
    res.status(500).send('❌ Xatolik yuz berdi');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
