const express = require("express");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");

const app = express();
app.use(express.json());

const sessions = {}; // نخزن كل Session حسب SenderId

// =======================================================
// 📌 1) إنشاء QR (Start Session)
// =======================================================
app.get("/init/:senderId", async (req, res) => {
    try {
        const senderId = req.params.senderId;

        const authPath = `./sessions/${senderId}`;
        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false
        });

        sessions[senderId] = sock;

        sock.ev.on("creds.update", saveCreds);

        let qrSVG = "";

        sock.ev.on("connection.update", async (update) => {
            const { qr, connection } = update;

            if (qr) {
                qrSVG = await qrcode.toDataURL(qr);
                res.json({ qr: qrSVG });
            }

            if (connection === "open") {
                console.log(`Sender ${senderId} connected successfully`);
            }
        });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

// =======================================================
// 📌 2) Send Message
// =======================================================
app.post("/send", async (req, res) => {
    try {
        const { senderId, phone, message } = req.body;

        const sock = sessions[senderId];
        if (!sock) return res.status(400).json({ error: "Sender not connected" });

        const normalized = phone.replace("+", "").trim();
        const jid = normalized + "@s.whatsapp.net";

        await sock.sendMessage(jid, { text: message });

        res.json({ success: true });
    }
    catch (err) {
        console.log(err);
        res.status(500).json({ error: err.message });
    }
});

// =======================================================
// 📌 3) Send Bulk Messages
// =======================================================
app.post("/send-bulk", async (req, res) => {
    try {
        const { senderId, phones, message } = req.body;

        const sock = sessions[senderId];
        if (!sock) return res.status(400).json({ error: "Sender not connected" });

        for (let phone of phones) {
            const normalized = phone.replace("+", "").trim();
            const jid = normalized + "@s.whatsapp.net";

            await sock.sendMessage(jid, { text: message });
            await new Promise(r => setTimeout(r, 600));
        }

        res.json({ success: true, total: phones.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =======================================================
// Server Start
// =======================================================
app.listen(3000, () => {
    console.log("WhatsApp Engine Running on port 3000");
});
