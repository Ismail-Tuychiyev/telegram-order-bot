require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.CHAT_ID;

app.post('/send-order', async (req, res) => {
  const { products, total } = req.body;

  const productList = products.map((item, i) =>
    `${i + 1}. ${item.name} – ${item.price.toLocaleString()} so'm`
  ).join('\n');

  const message = `
  🛒 <b>Salom!</b>
  Siz quyidagi mahsulotlarga buyurtma bermoqdasiz.
  
  💰 <b>Jami:</b> 0 so'm
  
  Iltimos, telefon raqamingiz va yetkazib berish manzilingizni yozing.
  `;

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

