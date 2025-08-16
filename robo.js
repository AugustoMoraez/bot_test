const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const client = new Client();
const sessions = {}; // Armazena o estado de cada usuário

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('🤖 Robô do restaurante está online!');
});

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

function isWithinOpeningHours() {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 16 || hour === 0;
}

client.on('message', async msg => {
    const from = msg.from;

    // Ignora grupos
    if (!from.endsWith('@c.us')) return;

    const lowerBody = msg.body.toLowerCase();

    // Início do atendimento
    if (/(oi|olá|ola|menu|pedido|cardápio|cardapio)/i.test(lowerBody)) {

        if (!isWithinOpeningHours()) {
            await msg.reply(`Olá! Nosso restaurante atende apenas entre *18:00 e 00:00*. Por favor, entre em contato nesse horário. 🍽️`);
            return;
        }

        const contact = await msg.getContact();
        const name = contact.pushname || 'cliente';

        sessions[from] = { stage: 'cardapio' };

        await delay(1000);
        await msg.reply(`Olá, ${name.split(" ")[0]}! Seja bem-vindo ao *Restaurante Delícia na Brasa*! 🔥`);

        await delay(2000);
        await msg.reply(`Já vou te enviar o nosso cardápio em PDF para você escolher à vontade. 😋`);

        const pdf = MessageMedia.fromFilePath('./cardapio.pdf');
        await delay(2000);
        await client.sendMessage(from, pdf, {
            caption: '📄 *Cardápio Atualizado*'
        });

        await delay(2000);
        await client.sendMessage(from, 'Deseja fazer o pedido para *Retirada* ou *Entrega*? 🛍️🚚');
        sessions[from].stage = 'retirada_ou_entrega';
        return;
    }

    // Gerenciamento de etapas
    if (sessions[from]) {
        const session = sessions[from];

        switch (session.stage) {

            case 'retirada_ou_entrega':
                if (/retirada/i.test(lowerBody)) {
                    session.tipo = 'retirada';
                    session.stage = 'pagamento';
                    await delay(1000);
                    await msg.reply('Perfeito! Qual será a forma de pagamento? 💳 Pix, Cartão ou Espécie?');
                } else if (/entrega/i.test(lowerBody)) {
                    session.tipo = 'entrega';
                    session.stage = 'endereco';
                    await delay(1000);
                    await msg.reply('Por favor, envie o endereço completo para a entrega 🏠');
                } else {
                    await msg.reply('Por favor, responda com *Retirada* ou *Entrega*.');
                }
                break;

            case 'endereco':
                session.endereco = msg.body;
                session.stage = 'pagamento';
                await delay(1000);
                await msg.reply('Endereço anotado! Agora, qual será a forma de pagamento? 💳 Pix, Cartão ou Espécie?');
                break;

            case 'pagamento':
                if (/pix|cart[aã]o/i.test(lowerBody)) {
                    session.pagamento = lowerBody;
                    session.stage = 'finalizado';
                    await delay(1000);
                    await msg.reply('Tudo certo! Em instantes confirmaremos seu pedido. Muito obrigado 😄🍽️');
                    delete sessions[from]; // Finaliza sessão
                } else if (/esp[eé]cie/i.test(lowerBody)) {
                    session.pagamento = 'espécie';
                    session.stage = 'troco';
                    await delay(1000);
                    await msg.reply('Gostaria que levássemos troco para quanto? 💰');
                } else {
                    await msg.reply('Por favor, informe: *Pix*, *Cartão* ou *Espécie*.');
                }
                break;

            case 'troco':
                session.troco = msg.body;
                session.stage = 'finalizado';
                await delay(1000);
                await msg.reply(`Certo! Levaremos troco para *${session.troco}*. Seu pedido será confirmado em breve. 😄🍽️`);
                delete sessions[from]; // Finaliza sessão
                break;

        }
    }
});
