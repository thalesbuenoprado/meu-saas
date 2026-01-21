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
    res.json({ status: 'ok', service: 'puppeteer-stories-v2' });
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

// ================================================
// GERAR HTML DO LOGO (reutilizável)
// ================================================
function getLogoHTML(logo, position = 'top-right') {
    if (!logo) return '';
    
    const positions = {
        'top-right': 'top:40px;right:40px;',
        'top-left': 'top:40px;left:40px;',
        'bottom-right': 'bottom:40px;right:40px;',
        'bottom-left': 'bottom:40px;left:40px;'
    };
    
    const posStyle = positions[position] || positions['top-right'];
    
    return `
        <div class="logo-container" style="position:absolute;${posStyle}width:120px;height:120px;background:rgba(0,0,0,0.6);border-radius:50%;display:flex;align-items:center;justify-content:center;padding:10px;">
            <img src="${logo}" style="max-width:90px;max-height:90px;object-fit:contain;border-radius:8px;" />
        </div>
    `;
}

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
    const logo = data.logo || '';  // ← NOVO: receber logo

    const baseStyles = `
        <style>
            @import url(https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap);
            *{margin:0;padding:0;box-sizing:border-box;}
            body{width:1080px;height:1920px;font-family:Inter,sans-serif;overflow:hidden;}
            .logo-container{z-index:100;box-shadow:0 4px 20px rgba(0,0,0,0.3);}
        </style>
    `;

    // ========================================
    // TEMPLATE: VOCÊ SABIA?
    // ========================================
    if (template === 'voce-sabia') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story{width:1080px;height:1920px;background:linear-gradient(180deg,${corPrimaria} 0%,${corFundo} 100%);padding:120px 80px;display:flex;flex-direction:column;position:relative;}
            .icon-top{font-size:140px;text-align:center;margin-bottom:60px;margin-top:40px;}
            .pergunta{font-family:Playfair Display,serif;font-size:80px;color:${corSecundaria};text-align:center;margin-bottom:80px;line-height:1.3;}
            .resposta{background:rgba(212,175,55,0.15);border-left:12px solid ${corSecundaria};padding:50px;margin-bottom:80px;border-radius:0 20px 20px 0;}
            .resposta p{color:white;font-size:52px;line-height:1.5;}
            .destaque{background:${corSecundaria};color:${corFundo};padding:40px 50px;border-radius:24px;text-align:center;font-weight:700;font-size:52px;}
            .footer{margin-top:auto;text-align:center;padding-top:60px;border-top:2px solid rgba(212,175,55,0.3);}
            .advogado{color:white;font-size:44px;font-weight:600;}
            .oab{color:#888;font-size:36px;margin-top:12px;}
            .cta{color:${corSecundaria};font-size:40px;margin-top:50px;}
        </style></head><body>
        <div class="story">
            ${getLogoHTML(logo, 'top-right')}
            <div class="icon-top">⚖️</div>
            <div class="pergunta">${pergunta}</div>
            <div class="resposta"><p>${resposta}</p></div>
            <div class="destaque">${destaque}</div>
            <div class="footer">
                <div class="advogado">${nomeAdvogado}</div>
                <div class="oab">${oab}</div>
                <div class="cta">↑ ${cta}</div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: BULLETS / LISTA
    // ========================================
    if (template === 'bullets') {
        let bulletsHTML = '';
        const icons = ['✓', '✓', '✓', '✓'];
        for (let i = 0; i < bullets.length && i < 4; i++) {
            const b = bullets[i];
            const bulletText = typeof b === 'string' ? b : (b.titulo || b.texto || b);
            const icon = icons[i] || '✓';
            bulletsHTML += `
                <div class="bullet">
                    <div class="bullet-icon">${icon}</div>
                    <div class="bullet-text">${bulletText}</div>
                </div>
            `;
        }
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story{width:1080px;height:1920px;background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%);padding:100px 72px;display:flex;flex-direction:column;position:relative;}
            .badge{background:${corSecundaria};color:white;font-size:32px;font-weight:700;padding:18px 36px;border-radius:60px;align-self:flex-start;margin-bottom:50px;text-transform:uppercase;letter-spacing:3px;margin-top:20px;}
            .headline{font-family:Montserrat,sans-serif;font-size:68px;font-weight:800;color:white;line-height:1.2;margin-bottom:60px;}
            .headline span{color:${corSecundaria};}
            .bullets{flex:1;display:flex;flex-direction:column;gap:32px;}
            .bullet{display:flex;align-items:center;gap:36px;background:rgba(255,255,255,0.08);padding:40px;border-radius:24px;}
            .bullet-icon{width:80px;height:80px;background:linear-gradient(135deg,${corSecundaria},#16a34a);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:40px;color:white;flex-shrink:0;}
            .bullet-text{color:white;font-size:44px;line-height:1.4;}
            .cta-box{background:linear-gradient(135deg,${corSecundaria},#b8962e);padding:50px;border-radius:32px;text-align:center;margin-top:auto;}
            .cta-box p{color:white;font-weight:700;font-size:44px;}
            .cta-box span{color:rgba(255,255,255,0.8);font-size:36px;display:block;margin-top:16px;}
            .footer-info{display:flex;justify-content:space-between;align-items:center;margin-top:40px;padding-top:30px;border-top:1px solid rgba(255,255,255,0.1);}
            .advogado-nome{color:white;font-size:36px;font-weight:600;}
            .advogado-oab{color:#888;font-size:30px;}
        </style></head><body>
        <div class="story">
            ${getLogoHTML(logo, 'top-right')}
            <div class="badge">✓ ${area}</div>
            <div class="headline">${headline}</div>
            <div class="bullets">${bulletsHTML}</div>
            <div class="cta-box">
                <p>${cta}</p>
                <span>↑ Salve este post!</span>
            </div>
            <div class="footer-info">
                <div>
                    <div class="advogado-nome">${nomeAdvogado}</div>
                    <div class="advogado-oab">${oab}</div>
                </div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: ESTATÍSTICA
    // ========================================
    if (template === 'estatistica') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story{width:1080px;height:1920px;background:linear-gradient(180deg,#18181b 0%,#27272a 50%,#18181b 100%);padding:100px 72px;display:flex;flex-direction:column;position:relative;}
            .area-tag{color:${corSecundaria};font-size:36px;font-weight:600;text-transform:uppercase;letter-spacing:6px;margin-bottom:40px;margin-top:60px;}
            .headline{font-family:Montserrat,sans-serif;font-size:64px;font-weight:700;color:white;line-height:1.3;margin-bottom:80px;}
            .stat-card{background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05));border:4px solid rgba(245,158,11,0.3);border-radius:48px;padding:70px;text-align:center;margin-bottom:50px;}
            .stat-number{font-family:Montserrat,sans-serif;font-size:160px;font-weight:800;color:${corSecundaria};line-height:1;}
            .stat-label{color:#a1a1aa;font-size:40px;margin-top:24px;text-transform:uppercase;letter-spacing:4px;}
            .info-text{color:#d4d4d8;font-size:44px;line-height:1.5;text-align:center;padding:50px;background:rgba(255,255,255,0.05);border-radius:32px;margin-bottom:auto;}
            .footer{display:flex;align-items:center;justify-content:space-between;padding-top:50px;border-top:2px solid rgba(255,255,255,0.1);margin-top:auto;}
            .advogado-info{display:flex;align-items:center;gap:32px;}
            .avatar{width:120px;height:120px;background:linear-gradient(135deg,${corSecundaria},#d97706);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:48px;}
            .advogado-info .name{color:white;font-size:40px;font-weight:600;}
            .advogado-info .title{color:#71717a;font-size:32px;}
            .swipe{color:${corSecundaria};font-size:36px;display:flex;flex-direction:column;align-items:center;gap:10px;}
        </style></head><body>
        <div class="story">
            ${getLogoHTML(logo, 'top-right')}
            <div class="area-tag">${area}</div>
            <div class="headline">${headline}</div>
            <div class="stat-card">
                <div class="stat-number">${estatistica.numero || estatistica.valor || '70%'}</div>
                <div class="stat-label">${estatistica.contexto || estatistica.label || 'dos casos'}</div>
            </div>
            <div class="info-text">${resposta || estatistica.explicacao || ''}</div>
            <div class="footer">
                <div class="advogado-info">
                    <div class="avatar">${iniciais || 'AD'}</div>
                    <div>
                        <div class="name">${nomeAdvogado}</div>
                        <div class="title">${area}</div>
                    </div>
                </div>
                <div class="swipe"><span>↑</span>Saiba mais</div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: URGENTE
    // ========================================
    if (template === 'urgente') {
        const alerta = data.alerta || headline || 'ATENÇÃO!';
        const prazo = data.prazo || estatistica.valor || '';
        const risco = data.risco || '';
        const acao = data.acao || cta;
        
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story{width:1080px;height:1920px;background:linear-gradient(180deg,#450a0a 0%,#1c1917 100%);padding:100px 72px;display:flex;flex-direction:column;position:relative;}
            .alert-badge{background:#dc2626;color:white;font-size:36px;font-weight:700;padding:22px 44px;border-radius:16px;align-self:flex-start;margin-bottom:50px;margin-top:40px;display:flex;align-items:center;gap:16px;}
            .headline{font-family:Montserrat,sans-serif;font-size:72px;font-weight:800;color:white;line-height:1.2;margin-bottom:60px;}
            .headline span{color:#fca5a5;}
            .prazo-box{background:rgba(220,38,38,0.2);border:6px solid #dc2626;border-radius:40px;padding:60px;text-align:center;margin-bottom:60px;}
            .prazo-label{color:#fca5a5;font-size:36px;text-transform:uppercase;letter-spacing:6px;margin-bottom:24px;}
            .prazo-valor{font-family:Montserrat,sans-serif;font-size:120px;font-weight:800;color:#dc2626;}
            .risco-box{background:rgba(255,255,255,0.05);padding:50px;border-radius:24px;margin-bottom:auto;}
            .risco-box p{color:#e7e5e4;font-size:44px;line-height:1.5;}
            .cta-urgente{background:#dc2626;color:white;padding:50px;border-radius:32px;text-align:center;font-weight:700;font-size:48px;margin-top:auto;}
            .cta-urgente span{display:block;font-size:36px;font-weight:400;margin-top:16px;opacity:0.8;}
            .footer-urgente{display:flex;justify-content:center;margin-top:40px;}
            .advogado-urgente{color:white;font-size:36px;text-align:center;}
            .advogado-urgente span{color:#888;display:block;font-size:30px;margin-top:8px;}
        </style></head><body>
        <div class="story">
            ${getLogoHTML(logo, 'top-right')}
            <div class="alert-badge">🚨 ATENÇÃO</div>
            <div class="headline">${alerta}</div>
            ${prazo ? `
            <div class="prazo-box">
                <div class="prazo-label">Prazo</div>
                <div class="prazo-valor">${prazo}</div>
            </div>
            ` : ''}
            ${risco ? `
            <div class="risco-box">
                <p>⚠️ ${risco}</p>
            </div>
            ` : ''}
            <div class="cta-urgente">${acao}<span>Não perca seus direitos!</span></div>
            <div class="footer-urgente">
                <div class="advogado-urgente">${nomeAdvogado}<span>${oab}</span></div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: PREMIUM
    // ========================================
    if (template === 'premium') {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story{width:1080px;height:1920px;background:linear-gradient(180deg,${corFundo} 0%,#16213e 100%);padding:100px 72px;display:flex;flex-direction:column;position:relative;overflow:hidden;}
            .logo-area{display:flex;align-items:center;gap:32px;margin-bottom:80px;margin-top:40px;}
            .logo-icon{width:140px;height:140px;background:linear-gradient(135deg,${corSecundaria},#b8962e);border-radius:28px;display:flex;align-items:center;justify-content:center;font-size:72px;}
            .logo-text{color:white;font-family:Playfair Display,serif;font-size:48px;}
            .divider{width:180px;height:6px;background:linear-gradient(90deg,${corSecundaria},transparent);margin-bottom:60px;}
            .tema{color:${corSecundaria};font-size:36px;text-transform:uppercase;letter-spacing:10px;margin-bottom:32px;}
            .headline{font-family:Playfair Display,serif;font-size:80px;color:white;line-height:1.3;margin-bottom:80px;}
            .content-box{background:rgba(212,175,55,0.08);border:2px solid rgba(212,175,55,0.2);border-radius:40px;padding:60px;margin-bottom:60px;}
            .content-box p{color:#e2e8f0;font-size:46px;line-height:1.6;}
            .tip{display:flex;align-items:flex-start;gap:32px;margin-bottom:auto;}
            .tip-icon{color:${corSecundaria};font-size:60px;}
            .tip p{color:#94a3b8;font-size:40px;line-height:1.5;}
            .tip strong{color:${corSecundaria};}
            .footer{display:flex;justify-content:space-between;align-items:center;padding-top:50px;border-top:2px solid rgba(212,175,55,0.2);margin-top:auto;}
            .contact{color:#64748b;font-size:36px;}
            .contact strong{color:white;display:block;font-size:40px;}
            .cta-arrow{width:140px;height:140px;background:linear-gradient(135deg,${corSecundaria},#b8962e);border-radius:50%;display:flex;align-items:center;justify-content:center;color:${corFundo};font-size:64px;}
        </style></head><body>
        <div class="story">
            ${getLogoHTML(logo, 'top-right')}
            <div class="logo-area">
                <div class="logo-icon">⚖️</div>
                <div class="logo-text">${nomeAdvogado || 'Advocacia'}</div>
            </div>
            <div class="divider"></div>
            <div class="tema">${area}</div>
            <div class="headline">${headline}</div>
            <div class="content-box"><p>${resposta}</p></div>
            ${dica ? `
            <div class="tip">
                <div class="tip-icon">💡</div>
                <p><strong>Dica:</strong> ${dica}</p>
            </div>
            ` : ''}
            <div class="footer">
                <div class="contact">
                    <strong>${telefone || instagram}</strong>
                    ${instagram && telefone ? instagram : ''}
                </div>
                <div class="cta-arrow">→</div>
            </div>
        </div>
        </body></html>`;
    }

    throw new Error('Template nao encontrado: ' + template);
}

app.listen(PORT, function() {
    console.log('=================================');
    console.log('🎨 Puppeteer Stories v2 - COM LOGO');
    console.log('=================================');
    console.log('✅ Porta:', PORT);
    console.log('🖼️ Logo: ATIVO em todos templates');
    console.log('=================================');
});