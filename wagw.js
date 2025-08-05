const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const readline = require('readline');


async function startSock() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
        if (qr) {
            console.log('?? Scan QR Code ini dengan WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('? Bot tersambung ke WhatsApp!');
	startLoop(sock); // Mulai input interaktif
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.message || 'Unknown';
            console.log('? Koneksi terputus:', reason);

            const shouldReconnect =
                !lastDisconnect?.error?.output?.statusCode ||
                lastDisconnect.error.output.statusCode !== 401;

            if (shouldReconnect) {
                console.log('?? Mencoba menyambung ulang...');
                startSock();
            } else {
                console.log('? Tidak bisa reconnect, mungkin karena logout dari HP. Hapus folder auth dan scan ulang QR.');
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        //if (!msg.message || msg.key.fromMe) return;
	if (!msg.message) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const sender = msg.key.remoteJid;

        if (text?.toLowerCase() === 'ping') {
            await sock.sendMessage(sender, { text: 'pong!' });
		 // ? Kirim pesan ke nomor lain setelah bot tersambung
            await sock.sendMessage('6282340268207@s.whatsapp.net', {
                text: 'Halo! Ini pesan otomatis dari bot WhatsApp.'
            });
	 console.log('Mengirim pesan ke Whatsapp');
        }
    });
}

// Untuk menangani error yang tidak tertangkap
process.on('unhandledRejection', (err) => {
    console.error('?? Unhandled Rejection:', err);
});

function startLoop(sock) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    function tanya() {
        rl.question("Masukan nomor HP: ", (phone) => {
            rl.question("Masukan Pesan: ", async (message) => {
                const jid = phone.replace(/^0/, "62") + "@s.whatsapp.net";

                try {
                    await sock.sendMessage(jid, { text: message });
                    console.log("Alert - Pesan terkirim");
                } catch (err) {
                    console.error("? Gagal mengirim pesan:", err);
                }

                rl.question("Ingin input lagi (Y/N): ", (jawab) => {
                    if (jawab.toLowerCase() === 'y') {
                        console.log("");
                        tanya(); // ulang lagi
                    } else {
                        console.log("Program berakhir.");
                        rl.close();
                        process.exit();
                    }
                });
            });
        });
    }

    tanya(); // mulai
}

startSock();