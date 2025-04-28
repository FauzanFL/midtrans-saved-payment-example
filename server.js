require('dotenv').config();
const express = require('express');
const cors = require('cors');
const midtransClient = require('midtrans-client');
const path = require('path');
const { default: axios } = require('axios');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

let id = 1;
const card_data = [];

const snap = new midtransClient.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

app.get('/get-saved-card', async (req, res) => {
    const dataSend = card_data.map((v) => {
        return {
            id: v.id,
            masked_card: v.masked_card
        }
    })
    res.json(dataSend);
});

app.post('/get-snap-token', async (req, res) => {
    const param = {
        transaction_details: {
            order_id: Math.floor(Math.random() * 10000000),
            gross_amount: 100000
        },
        credit_card: {
            secure: true,
            save_card: true
        }
    }

    try {
        const transaction = await snap.createTransaction(param);
        return res.json({token: transaction.token});
    } catch(e) {
        console.error('Midtrans Error: ', e);
        return res.status(500).send({ error: 'Failed to create transaction'});
    }
});

app.post('/midtrans-notification', async (req, res) => {
    const notificationJson = req.body;

    if (notificationJson.saved_token_id) {
        const dataInArr = card_data.find(d => d.masked_card == notificationJson.masked_card);
        if (!dataInArr) {
            const data = {
                id,
                saved_token: notificationJson.saved_token_id,
                expiry: notificationJson.saved_token_id_expired_at,
                masked_card: notificationJson.masked_card,
                bank: notificationJson.bank,
                card_type: notificationJson.card_type
            };
            id++;
            card_data.push(data);
        }
    }
    res.status(200).send('OK');
});

app.post("/saved-card/charge", async (req, res) => {
    const { card_id } = req.body;
    const card = card_data.find(c => c.id == card_id);
    
    try {
        const response = await axios.post('https://api.sandbox.midtrans.com/v2/charge',
            {
                payment_type: 'credit_card',
                transaction_details: {
                    order_id: Math.floor(Math.random() * 10000000),
                    gross_amount: 100000,
                },
                credit_card: {
                    token_id: card.saved_token,
                },
            },
            {
                headers: {
                    Authorization: `Basic ${Buffer.from(process.env.MIDTRANS_SERVER_KEY + ':').toString('base64')}`,
                    'Content-Type': 'application/json',
                }
            }
        )
        return res.send({message: "Payment success"});
    } catch(e) {
        return res.status(500).send({message: "Payment failed"});
    }

})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});