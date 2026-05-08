const net = require('net');
const tls = require('tls');
const {
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASS,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER
} = require('../config/env');

function isSmtpConfigured() {
    return Boolean(SMTP_HOST && SMTP_FROM);
}

function encodeSubject(subject) {
    return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

function stripHtml(html) {
    return String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function escapeDotLines(message) {
    return String(message || '').replace(/^\./gm, '..');
}

function createEmailMessage({ to, subject, html, text }) {
    const boundary = `shoponline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const plainText = text || stripHtml(html);

    return [
        `From: ${SMTP_FROM}`,
        `To: ${to}`,
        `Subject: ${encodeSubject(subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        plainText,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        '',
        html,
        '',
        `--${boundary}--`
    ].join('\r\n');
}

function connectSocket() {
    return new Promise((resolve, reject) => {
        const socketOptions = {
            host: SMTP_HOST,
            port: SMTP_PORT,
            servername: SMTP_HOST
        };
        const socket = SMTP_SECURE
            ? tls.connect(socketOptions)
            : net.connect(socketOptions);

        socket.setEncoding('utf8');
        socket.setTimeout(15000);
        if (SMTP_SECURE) {
            socket.once('secureConnect', () => resolve(socket));
        } else {
            socket.once('connect', () => resolve(socket));
        }
        socket.once('error', reject);
        socket.once('timeout', () => {
            socket.destroy(new Error('SMTP connection timeout.'));
        });
    });
}

function createSmtpSession(initialSocket) {
    let socket = initialSocket;
    let buffer = '';
    const pendingReaders = [];

    function attachListeners(currentSocket) {
        currentSocket.on('data', (chunk) => {
            buffer += chunk;
            flushReaders();
        });
    }

    function isCompleteResponse(value) {
        const lines = value.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1] || '';

        return /^\d{3}\s/.test(lastLine);
    }

    function flushReaders() {
        while (pendingReaders.length && isCompleteResponse(buffer)) {
            const reader = pendingReaders.shift();
            const response = buffer;
            buffer = '';
            reader.resolve(response);
        }
    }

    function readResponse() {
        if (isCompleteResponse(buffer)) {
            const response = buffer;
            buffer = '';
            return Promise.resolve(response);
        }

        return new Promise((resolve, reject) => {
            pendingReaders.push({ resolve, reject });
        });
    }

    function sanitizeCommandForLog(value) {
        const text = String(value || '').trim();

        if (/^AUTH\b/i.test(text) || /^[A-Za-z0-9+/=]{8,}$/.test(text)) {
            return '<smtp-auth-redacted>';
        }

        return text;
    }

    async function command(value, expectedCodes = [250]) {
        socket.write(`${value}\r\n`);
        const response = await readResponse();
        const code = Number(response.slice(0, 3));

        if (!expectedCodes.includes(code)) {
            throw new Error(`SMTP command failed (${sanitizeCommandForLog(value)}): ${response.trim()}`);
        }

        return response;
    }

    function upgradeToTls() {
        return new Promise((resolve, reject) => {
            socket.removeAllListeners('data');
            socket = tls.connect({
                socket,
                servername: SMTP_HOST
            }, () => {
                socket.setEncoding('utf8');
                attachListeners(socket);
                resolve();
            });
            socket.once('error', reject);
        });
    }

    attachListeners(socket);

    return {
        readResponse,
        command,
        upgradeToTls,
        get socket() {
            return socket;
        }
    };
}

async function sendSmtpMail(mail) {
    const socket = await connectSocket();
    const session = createSmtpSession(socket);

    try {
        await session.readResponse();
        let ehloResponse = await session.command(`EHLO ${SMTP_HOST}`, [250]);

        if (!SMTP_SECURE && /STARTTLS/i.test(ehloResponse)) {
            await session.command('STARTTLS', [220]);
            await session.upgradeToTls();
            ehloResponse = await session.command(`EHLO ${SMTP_HOST}`, [250]);
        }

        if (SMTP_USER && SMTP_PASS) {
            await session.command('AUTH LOGIN', [334]);
            await session.command(Buffer.from(SMTP_USER).toString('base64'), [334]);
            await session.command(Buffer.from(SMTP_PASS).toString('base64'), [235]);
        }

        await session.command(`MAIL FROM:<${extractAddress(SMTP_FROM)}>`, [250]);
        await session.command(`RCPT TO:<${mail.to}>`, [250, 251]);
        await session.command('DATA', [354]);
        session.socket.write(`${escapeDotLines(createEmailMessage(mail))}\r\n.\r\n`);
        await session.readResponse();
        await session.command('QUIT', [221]);
    } finally {
        session.socket.end();
    }
}

function extractAddress(value) {
    const match = String(value || '').match(/<([^>]+)>/);
    return (match ? match[1] : value).trim();
}

async function sendMail(mail) {
    if (!isSmtpConfigured()) {
        console.log(`[DEV MAIL] SMTP chua cau hinh. Email gui toi ${mail.to}: ${mail.subject}`);
        console.log(stripHtml(mail.html || mail.text || ''));
        return { delivered: false, reason: 'smtp_not_configured' };
    }

    await sendSmtpMail(mail);
    return { delivered: true };
}

async function sendPasswordResetEmail({ to, fullName, resetLink, expiresAt }) {
    const expiresText = new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Asia/Ho_Chi_Minh'
    }).format(expiresAt);

    return sendMail({
        to,
        subject: 'Đặt lại mật khẩu ShopOnline',
        html: `
            <p>Xin chào ${fullName || 'bạn'},</p>
            <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ShopOnline.</p>
            <p><a href="${resetLink}">Bấm vào đây để đặt lại mật khẩu</a></p>
            <p>Liên kết này hết hạn lúc ${expiresText}.</p>
            <p>Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p>
        `,
        text: [
            `Xin chào ${fullName || 'bạn'},`,
            'Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ShopOnline.',
            `Link đặt lại mật khẩu: ${resetLink}`,
            `Liên kết này hết hạn lúc ${expiresText}.`,
            'Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.'
        ].join('\n')
    });
}

module.exports = {
    sendMail,
    sendPasswordResetEmail
};
