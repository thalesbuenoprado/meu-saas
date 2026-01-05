const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let browser = null;

async function getBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process']
        });
    }
    return browser;
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'puppeteer-stories' });
});

app.post('/render', async (req, res) => {
    const startTime = Date.now();
    try {
        const { html, width = 1080, height = 1920, format = 'png' } = req.body;
        if (!html) return res.status(400).json({ error: 'HTML obrigatorio' });
        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluateHandle('document.fonts.ready');
        const screenshot = await page.screenshot({ type: format, encoding: 'base64', fullPage: false });
        await page.close();
        res.json({ success: true, image: 'data:image/' + format + ';base64,' + screenshot, width, height, renderTimeMs: Date.now() - startTime });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao renderizar', details: error.message });
    }
});

app.post('/render-story', async (req, res) => {
    const startTime = Date.now();
    try {
        const { template, data, format = 'png' } = req.body;
        if (!template || !data) return res.status(400).json({ error: 'template e data obrigatorios' });
        const html = generateStoryHTML(template, data);
        const browserInstance = await getBrowser();
        const page = await browserInstance.newPage();
        await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluateHandle('document.fonts.ready');
        const screenshot = await page.screenshot({ type: format, encoding: 'base64', fullPage: false });
        await page.close();
        res.json({ success: true, image: 'data:image/' + format + ';base64,' + screenshot, template, renderTimeMs: Date.now() - startTime });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao renderizar story', details: error.message });
    }
});

function generateStoryHTML(template, data) {
    const corPrimaria = data.corPrimaria || '#1e3a5f';
    const corSecundaria = data.corSecundaria || '#d4af37';
    const corFundo = data.corFundo || '#0d1b2a';
    const pergunta = data.pergunta || '';
    const resposta = data.resposta || '';
    const destaque = data.destaque || '';
    const headline = data.headline || '';
    const bullets = data.bullets || [];
    const estatistica = data.estatistica || {};
    const area = data.area || '';
    const dica = data.dica || '';
    const nomeAdvogado = data.nomeAdvogado || '';
    const oab = data.oab || '';
    const telefone = data.telefone || '';
    const instagram = data.instagram || '';
    const iniciais = data.iniciais || '';
    const cta = data.cta || 'Arraste para saber mais';

    const baseStyles = '<style>@import url(https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap);*{margin:0;padding:0;box-sizing:border-box;}body{width:1080px;height:1920px;font-family:Inter,sans-serif;overflow:hidden;}</style>';

    if (template === 'voce-sabia') {
        return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + baseStyles + '<style>.story{width:1080px;height:1920px;background:linear-gradient(180deg,' + corPrimaria + ' 0%,' + corFundo + ' 100%);padding:80px;display:flex;flex-direction:column;}.icon-top{font-size:140px;text-align:center;margin-bottom:40px;}.pergunta{font-family:Playfair Display,serif;font-size:80px;color:' + corSecundaria + ';text-align:center;margin-bottom:60px;line-height:1.2;}.resposta{background:rgba(212,175,55,0.12);border-left:12px solid ' + corSecundaria + ';padding:50px;margin-bottom:60px;flex-shrink:0;}.resposta p{color:white;font-size:48px;line-height:1.4;word-wrap:break-word;}.destaque{background:' + corSecundaria + ';color:' + corFundo + ';padding:40px 50px;border-radius:24px;text-align:center;font-weight:700;font-size:52px;margin-bottom:40px;}.footer{margin-top:auto;text-align:center;padding-top:60px;border-top:2px solid rgba(212,175,55,0.2);}.advogado{color:white;font-size:44px;font-weight:600;}.oab{color:#aaa;font-size:36px;margin-top:10px;}.cta{color:' + corSecundaria + ';font-size:40px;margin-top:40px;}</style></head><body><div class="story"><div class="icon-top">⚖️</div><div class="pergunta">' + pergunta + '</div><div class="resposta"><p>' + (resposta || '') + '</p></div><div class="destaque">' + (destaque || 'SAIBA SEUS DIREITOS!') + '</div><div class="footer"><div class="advogado">' + (nomeAdvogado || '') + '</div><div class="oab">' + (oab || '') + '</div><div class="cta">↑ ' + (cta || 'Saiba mais') + '</div></div></div></body></html>';
    }

    if (template === 'bullets') {
        let bulletsHTML = '';
        const hasBullets = bullets && bullets.length > 0;

        if (hasBullets) {
            for (let i = 0; i < bullets.length; i++) {
                const b = bullets[i];
                const icon = b.icon || ['💰', '📋', '🏖️'][i] || '✓';
                bulletsHTML += '<div class="bullet"><div class="bullet-icon">' + icon + '</div><div class="bullet-text"><strong>' + b.titulo + '</strong>' + b.descricao + '</div></div>';
            }
        }

        const introTextHTML = resposta ? '<div class="intro-text">' + resposta + '</div>' : '';

        return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + baseStyles + '<style>.story{width:1080px;height:1920px;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);padding:100px 72px;display:flex;flex-direction:column;}.badge{background:' + corSecundaria + ';color:white;font-size:36px;font-weight:700;padding:20px 40px;border-radius:80px;align-self:flex-start;margin-bottom:60px;text-transform:uppercase;letter-spacing:4px;}.headline{font-family:Montserrat,sans-serif;font-size:80px;font-weight:800;color:white;line-height:1.2;margin-bottom:40px;}.headline span{color:' + corSecundaria + ';}.intro-text{color:#cbd5e1;font-size:48px;line-height:1.5;margin-bottom:60px;font-style:italic;}.bullets{flex:1;}.bullet{display:flex;align-items:flex-start;gap:48px;margin-bottom:60px;background:rgba(255,255,255,0.05);padding:48px;border-radius:40px;}.bullet-icon{width:128px;height:128px;background:linear-gradient(135deg,' + corSecundaria + ',#16a34a);border-radius:32px;display:flex;align-items:center;justify-content:center;font-size:64px;flex-shrink:0;}.bullet-text{color:white;font-size:48px;line-height:1.4;}.bullet-text strong{color:' + corSecundaria + ';display:block;margin-bottom:8px;font-size:52px;}.cta-box{background:linear-gradient(135deg,' + corSecundaria + ',#16a34a);padding:60px;border-radius:48px;text-align:center;margin-top:auto;}.cta-box p{color:white;font-weight:700;font-size:52px;}.cta-box span{color:rgba(255,255,255,0.8);font-size:40px;display:block;margin-top:20px;}</style></head><body><div class="story"><div class="badge">✓ ' + area + '</div><div class="headline">' + headline + '</div>' + introTextHTML + '<div class="bullets">' + bulletsHTML + '</div><div class="cta-box"><p>' + cta + '</p><span>↑ Toque no link da bio</span></div></div></body></html>';
    }

    if (template === 'estatistica') {
        return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + baseStyles + '<style>.story{width:1080px;height:1920px;background:linear-gradient(180deg,#18181b 0%,#27272a 50%,#18181b 100%);padding:100px 72px;display:flex;flex-direction:column;}.area-tag{color:' + corSecundaria + ';font-size:40px;font-weight:600;text-transform:uppercase;letter-spacing:8px;margin-bottom:40px;}.headline{font-family:Montserrat,sans-serif;font-size:72px;font-weight:700;color:white;line-height:1.3;margin-bottom:100px;}.stat-card{background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05));border:4px solid rgba(245,158,11,0.3);border-radius:60px;padding:80px;text-align:center;margin-bottom:60px;}.stat-number{font-family:Montserrat,sans-serif;font-size:192px;font-weight:800;color:' + corSecundaria + ';line-height:1;}.stat-label{color:#a1a1aa;font-size:44px;margin-top:32px;text-transform:uppercase;letter-spacing:4px;}.info-text{color:#d4d4d8;font-size:48px;line-height:1.5;text-align:center;padding:60px;background:rgba(255,255,255,0.05);border-radius:40px;margin-bottom:auto;}.footer{display:flex;align-items:center;justify-content:space-between;padding-top:60px;border-top:2px solid rgba(255,255,255,0.1);margin-top:auto;}.advogado-info{display:flex;align-items:center;gap:40px;}.avatar{width:144px;height:144px;background:linear-gradient(135deg,' + corSecundaria + ',#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:56px;}.advogado-info .name{color:white;font-size:44px;font-weight:600;}.advogado-info .title{color:#71717a;font-size:36px;}.swipe{color:' + corSecundaria + ';font-size:40px;display:flex;flex-direction:column;align-items:center;gap:12px;}</style></head><body><div class="story"><div class="area-tag">' + area + '</div><div class="headline">' + headline + '</div><div class="stat-card"><div class="stat-number">' + (estatistica.valor || '2x') + '</div><div class="stat-label">' + (estatistica.label || 'O valor cobrado') + '</div></div><div class="info-text">' + resposta + '</div><div class="footer"><div class="advogado-info"><div class="avatar">' + (iniciais || 'AD') + '</div><div><div class="name">' + nomeAdvogado + '</div><div class="title">' + area + '</div></div></div><div class="swipe"><span>↑</span>Saiba mais</div></div></div></body></html>';
    }

    if (template === 'urgente') {
        let warningsHTML = '';
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            warningsHTML += '<div class="warning-item">' + (b.texto || b) + '</div>';
        }
        return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + baseStyles + '<style>.story{width:1080px;height:1920px;background:linear-gradient(180deg,#450a0a 0%,#1c1917 100%);padding:100px 72px;display:flex;flex-direction:column;}.alert-badge{background:#dc2626;color:white;font-size:40px;font-weight:700;padding:24px 48px;border-radius:20px;align-self:flex-start;margin-bottom:60px;}.headline{font-family:Montserrat,sans-serif;font-size:88px;font-weight:800;color:white;line-height:1.2;margin-bottom:80px;}.headline span{color:#fca5a5;}.prazo-box{background:rgba(220,38,38,0.2);border:8px solid #dc2626;border-radius:48px;padding:80px;text-align:center;margin-bottom:80px;}.prazo-label{color:#fca5a5;font-size:40px;text-transform:uppercase;letter-spacing:8px;margin-bottom:32px;}.prazo-valor{font-family:Montserrat,sans-serif;font-size:144px;font-weight:800;color:#dc2626;}.prazo-desc{color:#a8a29e;font-size:44px;margin-top:20px;}.warning-list{flex:1;}.warning-item{display:flex;align-items:center;gap:40px;color:#e7e5e4;font-size:48px;margin-bottom:48px;padding-left:20px;}.warning-item::before{content:"⚠️";font-size:56px;}.cta-urgente{background:#dc2626;color:white;padding:60px;border-radius:40px;text-align:center;font-weight:700;font-size:56px;margin-top:auto;}.cta-urgente span{display:block;font-size:40px;font-weight:400;margin-top:20px;opacity:0.8;}</style></head><body><div class="story"><div class="alert-badge">🚨 ATENÇÃO</div><div class="headline">' + headline + '</div><div class="prazo-box"><div class="prazo-label">' + (estatistica.label || 'Prazo Máximo') + '</div><div class="prazo-valor">' + (estatistica.valor || '2 ANOS') + '</div><div class="prazo-desc">' + (estatistica.descricao || 'para ações trabalhistas') + '</div></div><div class="warning-list">' + warningsHTML + '</div><div class="cta-urgente">' + cta + '<span>Não perca seus direitos!</span></div></div></body></html>';
    }

    if (template === 'premium') {
        return '<!DOCTYPE html><html><head><meta charset="UTF-8">' + baseStyles + '<style>.story{width:1080px;height:1920px;background:linear-gradient(180deg,' + corFundo + ' 0%,#16213e 100%);padding:100px 72px;display:flex;flex-direction:column;position:relative;overflow:hidden;}.logo-area{display:flex;align-items:center;gap:40px;margin-bottom:100px;}.logo-icon{width:160px;height:160px;background:linear-gradient(135deg,' + corSecundaria + ',#b8962e);border-radius:32px;display:flex;align-items:center;justify-content:center;font-size:80px;}.logo-text{color:white;font-family:Playfair Display,serif;font-size:56px;}.divider{width:200px;height:8px;background:linear-gradient(90deg,' + corSecundaria + ',transparent);margin-bottom:80px;}.tema{color:' + corSecundaria + ';font-size:40px;text-transform:uppercase;letter-spacing:12px;margin-bottom:40px;}.headline{font-family:Playfair Display,serif;font-size:96px;color:white;line-height:1.3;margin-bottom:100px;}.content-box{background:rgba(212,175,55,0.08);border:2px solid rgba(212,175,55,0.2);border-radius:48px;padding:72px;margin-bottom:80px;}.content-box p{color:#e2e8f0;font-size:52px;line-height:1.6;}.tip{display:flex;align-items:flex-start;gap:40px;margin-bottom:auto;}.tip-icon{color:' + corSecundaria + ';font-size:72px;}.tip p{color:#94a3b8;font-size:44px;line-height:1.5;}.tip strong{color:' + corSecundaria + ';}.footer{display:flex;justify-content:space-between;align-items:center;padding-top:60px;border-top:2px solid rgba(212,175,55,0.2);margin-top:auto;}.contact{color:#64748b;font-size:40px;}.contact strong{color:white;display:block;font-size:44px;}.cta-arrow{width:160px;height:160px;background:linear-gradient(135deg,' + corSecundaria + ',#b8962e);border-radius:50%;display:flex;align-items:center;justify-content:center;color:' + corFundo + ';font-size:72px;}</style></head><body><div class="story"><div class="logo-area"><div class="logo-icon">⚖️</div><div class="logo-text">' + (nomeAdvogado || 'Advocacia') + '</div></div><div class="divider"></div><div class="tema">' + area + '</div><div class="headline">' + headline + '</div><div class="content-box"><p>' + resposta + '</p></div><div class="tip"><div class="tip-icon">💡</div><p><strong>Dica:</strong> ' + dica + '</p></div><div class="footer"><div class="contact"><strong>' + telefone + '</strong>' + instagram + '</div><div class="cta-arrow">→</div></div></div></body></html>';
    }

    throw new Error('Template nao encontrado: ' + template);
}

app.listen(PORT, function () {
    console.log('Puppeteer Stories Service rodando na porta ' + PORT);
});
