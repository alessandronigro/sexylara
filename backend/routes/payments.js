const express = require('express');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('../lib/supabase');
const router = express.Router();

router.post('/create-checkout-session', async (req, res) => {

    const { userid, id } = req.body;
    const PRODUCTS = {
        base: { price: process.env.STRIPE_PRICE_BASE, credits: 150 },
        standard: { price: process.env.STRIPE_PRICE_STANDARD, credits: 500 },
        premium: { price: process.env.STRIPE_PRICE_PREMIUM, credits: 1000 },
    };

    const prod = PRODUCTS[id];
    if (!prod) return res.status(400).json({ error: 'Tier non valido' });

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: prod.price, quantity: 1 }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/subscription?canceled=true`,
    });

    await supabase.from('payments').insert({
        user_id: userid,
        stripe_session_id: session.id,
        credits: prod.credits,
        amount: prod.amount_total || 0,
        status: 'pending',
    });

    res.json({ id: session.id });
});



router.get('/payments/:userId', async (req, res) => {
    const { data, error } = await supabase.from('payments').select('created_at,credits,amount,status').eq('user_id', req.params.userId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

module.exports = router;
