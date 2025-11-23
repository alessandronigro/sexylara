const express = require('express');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { supabase } = require('../lib/supabase');
const router = express.Router();





router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const sess = event.data.object;
        const payment = await supabase.from('payments').select().eq('stripe_session_id', sess.id).single();
        if (payment.data) {
            await supabase.from('payments').update({ amount: event.data.amount_total, status: 'paid' }).eq('stripe_session_id', sess.id);
            await supabase.from('user_profiles')
                .update({ credits: payment.data.credits })
                .eq('user_id', payment.data.user_id);
        }
    }

    res.json({ received: true });
});



module.exports = router;
