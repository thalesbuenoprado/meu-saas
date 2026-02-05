const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

let browser = null;
let browserStarting = false;

async function getBrowser() {
    // Se já está iniciando, aguarda
    if (browserStarting) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return getBrowser();
    }

    // Verifica se o browser está saudável
    if (browser) {
        try {
            // Testa se o browser ainda responde
            await browser.version();
        } catch (e) {
            console.log('⚠️ Browser crashado, reiniciando...');
            browser = null;
        }
    }

    if (!browser) {
        browserStarting = true;
        try {
            console.log('🚀 Iniciando novo browser...');
            browser = await puppeteer.launch({
                headless: 'new',
                protocolTimeout: 60000, // 60 segundos de timeout
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process',
                    '--no-zygote'
                ]
            });
            console.log('✅ Browser iniciado com sucesso!');
        } finally {
            browserStarting = false;
        }
    }
    return browser;
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'puppeteer-stories-v3' });
});

app.post('/render', async (req, res) => {
    const startTime = Date.now();
    let page = null;
    try {
        const { html, width = 1080, height = 1920, format = 'png' } = req.body;
        if (!html) return res.status(400).json({ error: 'HTML obrigatorio' });
        const browserInstance = await getBrowser();
        page = await browserInstance.newPage();
        await page.setViewport({ width, height, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle2', timeout: 90000 });
        await page.evaluateHandle('document.fonts.ready');
        const screenshot = await page.screenshot({ type: format, encoding: 'base64', fullPage: false });
        res.json({ success: true, image: 'data:image/' + format + ';base64,' + screenshot, width, height, renderTimeMs: Date.now() - startTime });
    } catch (error) {
        console.error('❌ Erro no /render:', error.message);
        res.status(500).json({ error: 'Falha ao renderizar', details: error.message });
    } finally {
        if (page) {
            try { await page.close(); } catch (e) { /* ignora */ }
        }
    }
});

app.post('/render-story', async (req, res) => {
    const startTime = Date.now();
    let page = null;
    try {
        const { template, data, format = 'png' } = req.body;
        if (!template || !data) return res.status(400).json({ error: 'template e data obrigatorios' });
        console.log('📱 Renderizando story:', template);
        const html = generateStoryHTML(template, data);
        const browserInstance = await getBrowser();
        page = await browserInstance.newPage();
        await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle2', timeout: 90000 });
        await page.evaluateHandle('document.fonts.ready');
        const screenshot = await page.screenshot({ type: format, encoding: 'base64', fullPage: false });
        console.log('✅ Story renderizado em', Date.now() - startTime, 'ms');
        res.json({ success: true, image: 'data:image/' + format + ';base64,' + screenshot, template, renderTimeMs: Date.now() - startTime });
    } catch (error) {
        console.error('❌ Erro no /render-story:', error.message);
        res.status(500).json({ error: 'Falha ao renderizar story', details: error.message });
    } finally {
        if (page) {
            try { await page.close(); } catch (e) { /* ignora */ }
        }
    }
});

function generateStoryHTML(template, data) {
    const corPrimaria = data.corPrimaria || '#1e3a5f';
    const corSecundaria = data.corSecundaria || '#d4af37';
    const corFundo = data.corFundo || '#0d1b2a';
    const pergunta = data.pergunta || data.tema || '';
    const resposta = data.resposta || '';
    const destaque = data.destaque || '';
    const headline = data.headline || data.tema || '';
    const bullets = data.bullets || [];
    const estatistica = data.estatistica || {};
    const area = data.area || '';
    const nomeAdvogado = data.nomeAdvogado || '';
    const oab = data.oab || '';
    const instagram = data.instagram || '';
    const logo = data.logo || '';
    
    // CTA: usa instagram se tiver, senão "Siga para mais dicas"
    const cta = data.cta || (instagram ? '@' + instagram.replace('@', '') : 'Siga para mais dicas');
    const dica = data.dica || 'Conhecer seus direitos é o primeiro passo para garantir sua proteção!';
    const topicos = data.topicos || [];
    const conclusao = data.conclusao || '';
    const tipoImagem = data.tipoImagem || 'stock';

    // Banco de fotos profissionais (Unsplash - URLs estáveis)
    const stockImages = {
        'trabalhista': [
            'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1080&h=400&fit=crop&crop=center',
        ],
        'trabalho': [
            'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1080&h=400&fit=crop&crop=center',
        ],
        'penal': [
            'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1593115057322-e94b77572f20?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1436450412740-6b988f486c6b?w=1080&h=400&fit=crop&crop=center',
        ],
        'criminal': [
            'https://images.unsplash.com/photo-1589994965851-a8f479c573a9?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1593115057322-e94b77572f20?w=1080&h=400&fit=crop&crop=center',
        ],
        'civil': [
            'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1568992687947-868a62a9f521?w=1080&h=400&fit=crop&crop=center',
        ],
        'consumidor': [
            'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1080&h=400&fit=crop&crop=center',
        ],
        'tributário': [
            'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&h=400&fit=crop&crop=center',
        ],
        'tributario': [
            'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1080&h=400&fit=crop&crop=center',
        ],
        'família': [
            'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1080&h=400&fit=crop&crop=center',
        ],
        'familia': [
            'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=1080&h=400&fit=crop&crop=center',
        ],
        'imobiliário': [
            'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1080&h=400&fit=crop&crop=center',
        ],
        'imobiliario': [
            'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=1080&h=400&fit=crop&crop=center',
        ],
        'default': [
            'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1479142506502-19b3a3b7ff33?w=1080&h=400&fit=crop&crop=center',
            'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1080&h=400&fit=crop&crop=center',
        ]
    };

    function getStockImage(areaText) {
        const areaLower = (areaText || '').toLowerCase();
        let images = stockImages.default;
        for (const [key, value] of Object.entries(stockImages)) {
            if (key !== 'default' && areaLower.includes(key)) {
                images = value;
                break;
            }
        }
        return images[Math.floor(Math.random() * images.length)];
    }

    const baseStyles = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap');
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { width: 1080px; height: 1920px; font-family: 'Inter', sans-serif; }
        </style>
    `;

    // Logo HTML
    const logoHTML = logo ? `
        <div style="display:flex;justify-content:center;margin-bottom:12px;">
            <img src="${logo}" style="width:90px;height:90px;object-fit:contain;border-radius:12px;background:rgba(0,0,0,0.4);padding:10px;" />
        </div>
    ` : '';

    // ========================================
    // TEMPLATE: VOCÊ SABIA?
    // ========================================
    if (template === 'voce-sabia') {
        // Mapeamento de área jurídica para keywords do Unsplash
        const areaKeywords = {
            'trabalhista': 'office,work,employee,business',
            'trabalho': 'office,work,employee,business',
            'penal': 'justice,court,law,legal',
            'criminal': 'justice,court,law,legal',
            'consumidor': 'shopping,consumer,store,purchase',
            'tributário': 'money,finance,tax,business',
            'tributario': 'money,finance,tax,business',
            'família': 'family,home,children,parents',
            'familia': 'family,home,children,parents',
            'civil': 'contract,document,agreement,handshake',
            'empresarial': 'business,corporate,office,meeting',
            'imobiliário': 'house,property,real-estate,building',
            'imobiliario': 'house,property,real-estate,building',
            'previdenciário': 'retirement,elderly,pension,senior',
            'previdenciario': 'retirement,elderly,pension,senior',
            'ambiental': 'nature,environment,forest,green',
            'digital': 'technology,computer,digital,cyber',
            'default': 'justice,law,legal,court'
        };

        // Imagem de fundo: stock ou IA
        const areaLower = (area || '').toLowerCase();
        let imageUrl;
        if (tipoImagem === 'ia') {
            const areaPrompts = {
                'trabalhista': 'professional office workplace, business meeting, corporate environment, legal documents on desk, modern office, blue tones, professional photography',
                'trabalho': 'professional office workplace, business meeting, corporate environment, legal documents on desk, modern office, blue tones, professional photography',
                'penal': 'justice courthouse interior, legal scales, gavel, law books, serious atmosphere, dramatic lighting, professional photography',
                'criminal': 'justice courthouse interior, legal scales, gavel, law books, serious atmosphere, dramatic lighting, professional photography',
                'consumidor': 'shopping consumer rights, retail store, customer service, modern commerce, protection shield concept, professional photography',
                'tributário': 'financial documents, tax papers, calculator, money management, business finance, professional desk, blue gold tones',
                'tributario': 'financial documents, tax papers, calculator, money management, business finance, professional desk, blue gold tones',
                'família': 'family home protection, house keys, family silhouette, warm atmosphere, legal protection concept, soft lighting',
                'familia': 'family home protection, house keys, family silhouette, warm atmosphere, legal protection concept, soft lighting',
                'civil': 'legal contract signing, handshake agreement, professional documents, business deal, corporate meeting',
                'empresarial': 'corporate boardroom, business strategy, professional meeting, modern office building, executive environment',
                'imobiliário': 'real estate property, house keys, modern building, property investment, architectural photography',
                'imobiliario': 'real estate property, house keys, modern building, property investment, architectural photography',
                'previdenciário': 'retirement planning, senior citizens, pension documents, social security concept, warm caring atmosphere',
                'previdenciario': 'retirement planning, senior citizens, pension documents, social security concept, warm caring atmosphere',
                'ambiental': 'environmental law, nature protection, green forest, sustainability, earth protection concept',
                'digital': 'digital technology, cyber security, computer code, modern technology, data protection, blue tech aesthetic',
                'default': 'legal justice scales, law books, gavel, professional legal environment, courthouse, golden and blue tones'
            };
            let basePrompt = areaPrompts.default;
            for (const [key, value] of Object.entries(areaPrompts)) {
                if (areaLower.includes(key)) { basePrompt = value; break; }
            }
            const imagePrompt = encodeURIComponent(`${basePrompt}, high quality, professional, clean background, no text, no watermark`);
            imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1080&height=400&nologo=true`;
        } else {
            imageUrl = getStockImage(area);
        }

        // Gera HTML dos tópicos - remove emojis e usa ícones visuais
        let topicosHTML = '';
        const iconColors = ['#d4af37', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0']; // dourado, verde, azul, laranja, roxo
        if (topicos && topicos.length > 0) {
            topicosHTML = topicos.map((topico, index) => {
                // Remove emojis do início do texto
                const textoLimpo = topico.replace(/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]\s*/u, '').trim();
                const cor = iconColors[index % iconColors.length];
                return `
                <div class="topico-item">
                    <span class="topico-icon" style="background: ${cor};"></span>
                    <span class="topico-text">${textoLimpo}</span>
                </div>
            `}).join('');
        } else if (resposta) {
            // Fallback: usa resposta como texto único
            topicosHTML = `<div class="topico-item"><span class="topico-icon" style="background: #d4af37;"></span><span class="topico-text">${resposta}</span></div>`;
        }

        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story {
                width: 1080px;
                height: 1920px;
                background: linear-gradient(180deg, ${corPrimaria} 0%, ${corFundo} 60%, #000 100%);
                padding: 60px;
                display: flex;
                flex-direction: column;
                position: relative;
                overflow: hidden;
            }
            /* Elementos decorativos */
            .story::before {
                content: '';
                position: absolute;
                top: -80px;
                right: -80px;
                width: 350px;
                height: 350px;
                background: radial-gradient(circle, ${corSecundaria}20 0%, transparent 70%);
                border-radius: 50%;
            }
            /* Header com logo grande */
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 40px;
            }
            .header-logo {
                width: 120px;
                height: 120px;
                object-fit: contain;
                border-radius: 16px;
                background: rgba(255,255,255,0.1);
                padding: 10px;
                border: 2px solid ${corSecundaria}40;
            }
            .header-badge {
                display: flex;
                align-items: center;
                gap: 12px;
                background: ${corSecundaria};
                color: ${corFundo};
                padding: 14px 28px;
                border-radius: 50px;
                font-size: 20px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            /* Você Sabia header */
            .voce-sabia-header {
                display: flex;
                align-items: center;
                gap: 20px;
                margin-bottom: 25px;
            }
            .voce-sabia-icon {
                width: 70px;
                height: 70px;
                background: linear-gradient(135deg, ${corSecundaria}, #b8962e);
                border-radius: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 36px;
            }
            .voce-sabia-text {
                font-family: 'Montserrat', sans-serif;
                font-size: 28px;
                font-weight: 800;
                color: ${corSecundaria};
                text-transform: uppercase;
                letter-spacing: 3px;
            }
            /* Pergunta/Título */
            .pergunta {
                font-family: 'Playfair Display', serif;
                font-size: 52px;
                color: white;
                line-height: 1.15;
                margin-bottom: 35px;
            }
            .pergunta::after {
                content: '';
                display: block;
                width: 80px;
                height: 5px;
                background: linear-gradient(90deg, ${corSecundaria}, transparent);
                margin-top: 20px;
                border-radius: 3px;
            }
            /* Lista de tópicos com emojis */
            .topicos-container {
                background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
                border: 1px solid rgba(255,255,255,0.1);
                border-left: 5px solid ${corSecundaria};
                border-radius: 0 20px 20px 0;
                padding: 35px 40px;
                margin-bottom: 30px;
            }
            .topico-item {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px 0;
                border-bottom: 1px solid rgba(255,255,255,0.08);
            }
            .topico-item:last-child {
                border-bottom: none;
                padding-bottom: 0;
            }
            .topico-item:first-child {
                padding-top: 0;
            }
            .topico-icon {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                flex-shrink: 0;
                box-shadow: 0 0 8px currentColor;
            }
            .topico-text {
                color: white;
                font-size: 26px;
                line-height: 1.35;
            }
            /* Conclusão */
            .conclusao-box {
                background: rgba(${corSecundaria === '#d4af37' ? '212,175,55' : '30,58,95'},0.2);
                border: 2px solid ${corSecundaria}50;
                border-radius: 16px;
                padding: 28px 35px;
                margin-bottom: 25px;
                text-align: center;
            }
            .conclusao-text {
                color: white;
                font-size: 30px;
                font-weight: 600;
                line-height: 1.4;
            }
            /* Dica */
            .dica-box {
                display: flex;
                align-items: center;
                gap: 18px;
                background: rgba(255,255,255,0.05);
                border-radius: 14px;
                padding: 22px 28px;
                margin-bottom: 25px;
            }
            .dica-text {
                color: rgba(255,255,255,0.9);
                font-size: 26px;
                line-height: 1.35;
            }
            /* CTA Button */
            .cta-button {
                background: linear-gradient(135deg, ${corSecundaria}, #b8962e);
                color: ${corFundo};
                padding: 26px 45px;
                border-radius: 14px;
                text-align: center;
                font-weight: 800;
                font-size: 28px;
                text-transform: uppercase;
                letter-spacing: 2px;
                box-shadow: 0 8px 25px ${corSecundaria}35;
            }
            /* Imagem representativa */
            .image-section {
                flex: 1;
                margin: 25px -60px;
                position: relative;
                overflow: hidden;
                min-height: 200px;
            }
            .image-section img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: brightness(0.7);
            }
            .image-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(180deg, ${corFundo} 0%, transparent 30%, transparent 70%, ${corFundo} 100%);
            }
            /* Footer */
            .footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 25px;
                border-top: 2px solid rgba(255,255,255,0.1);
            }
            .footer-left {
                display: flex;
                align-items: center;
                gap: 18px;
            }
            .footer-logo {
                width: 80px;
                height: 80px;
                object-fit: contain;
                border-radius: 12px;
                background: rgba(255,255,255,0.1);
                padding: 8px;
            }
            .footer-info {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .advogado {
                color: white;
                font-size: 26px;
                font-weight: 600;
            }
            .oab {
                color: ${corSecundaria};
                font-size: 20px;
                font-weight: 500;
            }
            .footer-right {
                text-align: right;
            }
            .cta-text {
                color: ${corSecundaria};
                font-size: 22px;
                font-weight: 600;
            }
            .cta-arrow {
                color: ${corSecundaria};
                font-size: 36px;
                margin-top: 4px;
            }
        </style></head><body>
        <div class="story">
            <div class="header">
                ${logo ? `<img src="${logo}" class="header-logo" />` : '<div></div>'}
                <div class="header-badge">⚖️ ${area || 'DIREITO'}</div>
            </div>

            <div class="voce-sabia-header">
                <div class="voce-sabia-icon">?</div>
                <div class="voce-sabia-text">Você Sabia?</div>
            </div>

            <div class="pergunta">${pergunta}</div>

            <div class="topicos-container">
                ${topicosHTML}
            </div>

            ${conclusao ? `
            <div class="conclusao-box">
                <div class="conclusao-text">${conclusao}</div>
            </div>
            ` : ''}

            <div class="dica-box">
                <div class="dica-text">${dica}</div>
            </div>

            <div class="cta-button">${destaque || 'CONHEÇA SEUS DIREITOS!'}</div>

            <div class="image-section">
                <img src="${imageUrl}" alt="Imagem representativa" />
                <div class="image-overlay"></div>
            </div>

            <div class="footer">
                <div class="footer-left">
                    ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                    <div class="footer-info">
                        <div class="advogado">${nomeAdvogado}</div>
                        ${oab ? `<div class="oab">${oab}</div>` : ''}
                    </div>
                </div>
                <div class="footer-right">
                    <div class="cta-text">${cta}</div>
                    <div class="cta-arrow">↑</div>
                </div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: BULLETS / LISTA
    // ========================================
    if (template === 'bullets') {
        // Cores para os bullets
        const bulletColors = ['#d4af37', '#4CAF50', '#2196F3', '#FF9800', '#9C27B0'];
        let bulletsHTML = '';
        for (let i = 0; i < bullets.length && i < 5; i++) {
            const b = bullets[i];
            const bulletText = typeof b === 'string' ? b : (b.titulo || b.texto || b);
            const cor = bulletColors[i % bulletColors.length];
            bulletsHTML += `
                <div class="bullet">
                    <div class="bullet-icon" style="background: ${cor};"></div>
                    <div class="bullet-text">${bulletText}</div>
                </div>
            `;
        }

        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story {
                width: 1080px;
                height: 1920px;
                background: linear-gradient(180deg, ${corPrimaria} 0%, ${corFundo} 60%, #000 100%);
                padding: 60px;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .header-logo {
                width: 100px;
                height: 100px;
                object-fit: contain;
                border-radius: 14px;
                background: rgba(255,255,255,0.1);
                padding: 8px;
            }
            .badge {
                background: ${corSecundaria};
                color: ${corFundo};
                font-size: 20px;
                font-weight: 700;
                padding: 12px 24px;
                border-radius: 50px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            .headline {
                font-family: 'Playfair Display', serif;
                font-size: 48px;
                font-weight: 700;
                color: white;
                line-height: 1.2;
                margin-bottom: 30px;
            }
            .headline::after {
                content: '';
                display: block;
                width: 80px;
                height: 5px;
                background: linear-gradient(90deg, ${corSecundaria}, transparent);
                margin-top: 20px;
                border-radius: 3px;
            }
            .bullets { display: flex; flex-direction: column; gap: 16px; margin-bottom: 25px; }
            .bullet {
                display: flex;
                align-items: center;
                gap: 18px;
                background: rgba(255,255,255,0.06);
                padding: 22px 28px;
                border-radius: 14px;
            }
            .bullet-icon {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .bullet-text { color: white; font-size: 26px; line-height: 1.35; }
            .cta-button {
                background: linear-gradient(135deg, ${corSecundaria}, #b8962e);
                color: ${corFundo};
                padding: 24px 40px;
                border-radius: 14px;
                text-align: center;
                font-weight: 800;
                font-size: 26px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            .image-section {
                flex: 1;
                margin: 25px -60px;
                position: relative;
                overflow: hidden;
                min-height: 150px;
            }
            .spacer { flex: 1; }
            .footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 20px;
                border-top: 2px solid rgba(255,255,255,0.1);
            }
            .footer-left { display: flex; align-items: center; gap: 15px; }
            .footer-logo { width: 70px; height: 70px; object-fit: contain; border-radius: 10px; background: rgba(255,255,255,0.1); padding: 6px; }
            .footer-info { display: flex; flex-direction: column; gap: 4px; }
            .advogado { color: white; font-size: 24px; font-weight: 600; }
            .oab { color: ${corSecundaria}; font-size: 18px; }
            .cta-text { color: ${corSecundaria}; font-size: 20px; font-weight: 600; }
        </style></head><body>
        <div class="story">
            <div class="header">
                ${logo ? `<img src="${logo}" class="header-logo" />` : '<div></div>'}
                <div class="badge">${area || 'DIREITO'}</div>
            </div>
            <div class="headline">${headline}</div>
            <div class="bullets">${bulletsHTML}</div>
            <div class="cta-button">${cta || 'SAIBA MAIS!'}</div>
            <div class="spacer"></div>
            <div class="footer">
                <div class="footer-left">
                    ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                    <div class="footer-info">
                        <div class="advogado">${nomeAdvogado}</div>
                        ${oab ? `<div class="oab">${oab}</div>` : ''}
                    </div>
                </div>
                <div class="cta-text">Siga para mais dicas ↑</div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: ESTATÍSTICA
    // ========================================
    if (template === 'estatistica') {
        const numero = estatistica.numero || estatistica.valor || '70%';
        const contexto = estatistica.contexto || estatistica.label || 'dos casos';
        const explicacao = estatistica.explicacao || resposta || '';

        // Imagem de fundo: stock ou IA
        let imageUrl;
        if (tipoImagem === 'ia') {
            const areaLower = (area || '').toLowerCase();
            const areaPrompts = {
                'trabalhista': 'professional office workplace, business statistics, corporate charts, modern office',
                'trabalho': 'professional office workplace, business statistics, corporate charts, modern office',
                'penal': 'justice courthouse, legal statistics, crime data visualization, serious atmosphere',
                'criminal': 'justice courthouse, legal statistics, crime data visualization, serious atmosphere',
                'consumidor': 'consumer data, shopping statistics, retail analytics, market research',
                'tributário': 'financial charts, tax statistics, money graphs, business analytics',
                'tributario': 'financial charts, tax statistics, money graphs, business analytics',
                'default': 'legal statistics, data visualization, professional charts, business analytics'
            };
            let basePrompt = areaPrompts.default;
            for (const [key, value] of Object.entries(areaPrompts)) {
                if (areaLower.includes(key)) { basePrompt = value; break; }
            }
            const imagePrompt = encodeURIComponent(`${basePrompt}, high quality, professional, no text, no watermark`);
            imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1080&height=350&nologo=true`;
        } else {
            imageUrl = getStockImage(area);
        }

        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story {
                width: 1080px;
                height: 1920px;
                background: linear-gradient(180deg, ${corPrimaria} 0%, ${corFundo} 60%, #000 100%);
                padding: 60px;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .header-logo {
                width: 100px;
                height: 100px;
                object-fit: contain;
                border-radius: 14px;
                background: rgba(255,255,255,0.1);
                padding: 8px;
            }
            .badge {
                background: ${corSecundaria};
                color: ${corFundo};
                font-size: 20px;
                font-weight: 700;
                padding: 12px 24px;
                border-radius: 50px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            .headline {
                font-family: 'Playfair Display', serif;
                font-size: 42px;
                font-weight: 700;
                color: white;
                line-height: 1.2;
                margin-bottom: 30px;
            }
            .stat-card {
                background: linear-gradient(135deg, rgba(${corSecundaria === '#d4af37' ? '212,175,55' : '30,58,95'},0.2), rgba(${corSecundaria === '#d4af37' ? '212,175,55' : '30,58,95'},0.05));
                border: 3px solid ${corSecundaria}50;
                border-radius: 24px;
                padding: 40px;
                text-align: center;
                margin-bottom: 25px;
            }
            .stat-number {
                font-family: 'Montserrat', sans-serif;
                font-size: 100px;
                font-weight: 800;
                color: ${corSecundaria};
                line-height: 1;
            }
            .stat-label {
                color: rgba(255,255,255,0.7);
                font-size: 26px;
                margin-top: 12px;
                text-transform: uppercase;
                letter-spacing: 3px;
            }
            .info-text {
                color: rgba(255,255,255,0.9);
                font-size: 28px;
                line-height: 1.5;
                padding: 30px;
                background: rgba(255,255,255,0.05);
                border-radius: 18px;
                border-left: 5px solid ${corSecundaria};
            }
            .image-section {
                flex: 1;
                margin: 25px -60px;
                position: relative;
                overflow: hidden;
                min-height: 150px;
            }
            .image-section img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: brightness(0.7);
            }
            .image-overlay {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(180deg, ${corFundo} 0%, transparent 30%, transparent 70%, ${corFundo} 100%);
            }
            .footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 20px;
                border-top: 2px solid rgba(255,255,255,0.1);
            }
            .footer-left { display: flex; align-items: center; gap: 15px; }
            .footer-logo { width: 70px; height: 70px; object-fit: contain; border-radius: 10px; background: rgba(255,255,255,0.1); padding: 6px; }
            .footer-info { display: flex; flex-direction: column; gap: 4px; }
            .advogado { color: white; font-size: 24px; font-weight: 600; }
            .oab { color: ${corSecundaria}; font-size: 18px; }
            .cta-text { color: ${corSecundaria}; font-size: 20px; font-weight: 600; }
        </style></head><body>
        <div class="story">
            <div class="header">
                ${logo ? `<img src="${logo}" class="header-logo" />` : '<div></div>'}
                <div class="badge">${area || 'ESTATÍSTICA'}</div>
            </div>
            <div class="headline">${headline}</div>
            <div class="stat-card">
                <div class="stat-number">${numero}</div>
                <div class="stat-label">${contexto}</div>
            </div>
            <div class="info-text">${explicacao}</div>
            <div class="image-section">
                <img src="${imageUrl}" alt="" />
                <div class="image-overlay"></div>
            </div>
            <div class="footer">
                <div class="footer-left">
                    ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                    <div class="footer-info">
                        <div class="advogado">${nomeAdvogado}</div>
                        ${oab ? `<div class="oab">${oab}</div>` : ''}
                    </div>
                </div>
                <div class="cta-text">Siga para mais dicas ↑</div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: URGENTE
    // ========================================
    if (template === 'urgente') {
        const alerta = data.alerta || headline || 'ATENÇÃO!';
        const prazo = data.prazo || '';
        const riscoRaw = data.risco || resposta || '';
        const acao = data.acao || 'Consulte um advogado';

        // Separar risco em frases para exibir como lista
        const riscoFrases = riscoRaw.split(/\.\s+/).filter(f => f.trim().length > 5).map(f => f.replace(/\.$/, '').trim());
        const riscoHTML = riscoFrases.length > 1
            ? riscoFrases.map(f => `<div class="risco-item"><span class="risco-icon"></span><span>${f}.</span></div>`).join('')
            : `<p>${riscoRaw}</p>`;

        // Imagem de fundo: stock ou IA
        let imageUrl;
        if (tipoImagem === 'ia') {
            const imagePrompt = encodeURIComponent('urgent legal deadline, clock time pressure, courthouse gavel, warning alert, dramatic red lighting, professional, no text, no watermark');
            imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1080&height=350&nologo=true`;
        } else {
            imageUrl = getStockImage(area);
        }

        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story {
                width: 1080px;
                height: 1920px;
                background: linear-gradient(180deg, #450a0a 0%, #1c1917 60%, #000 100%);
                padding: 60px;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .header-logo {
                width: 100px;
                height: 100px;
                object-fit: contain;
                border-radius: 14px;
                background: rgba(255,255,255,0.1);
                padding: 8px;
            }
            .alert-badge {
                background: #dc2626;
                color: white;
                font-size: 22px;
                font-weight: 700;
                padding: 14px 28px;
                border-radius: 50px;
                text-transform: uppercase;
                letter-spacing: 2px;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            .headline {
                font-family: 'Montserrat', sans-serif;
                font-size: 46px;
                font-weight: 800;
                color: white;
                line-height: 1.2;
                margin-bottom: 30px;
            }
            .prazo-box {
                background: rgba(220,38,38,0.15);
                border: 3px solid #dc2626;
                border-radius: 20px;
                padding: 30px;
                text-align: center;
                margin-bottom: 25px;
            }
            .prazo-label {
                color: #fca5a5;
                font-size: 20px;
                text-transform: uppercase;
                letter-spacing: 4px;
                margin-bottom: 10px;
            }
            .prazo-valor {
                font-family: 'Montserrat', sans-serif;
                font-size: 60px;
                font-weight: 800;
                color: #dc2626;
            }
            .risco-box {
                background: rgba(255,255,255,0.05);
                padding: 30px;
                border-radius: 18px;
                border-left: 5px solid #dc2626;
                margin-bottom: 20px;
            }
            .risco-box p { color: rgba(255,255,255,0.9); font-size: 26px; line-height: 1.5; margin: 0; }
            .risco-item { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 16px; }
            .risco-item:last-child { margin-bottom: 0; }
            .risco-icon { min-width: 12px; min-height: 12px; width: 12px; height: 12px; background: #dc2626; border-radius: 50%; margin-top: 10px; }
            .risco-item span:last-child { color: rgba(255,255,255,0.9); font-size: 26px; line-height: 1.4; }
            .cta-urgente {
                background: #dc2626;
                color: white;
                padding: 26px;
                border-radius: 16px;
                text-align: center;
                font-weight: 700;
                font-size: 28px;
                text-transform: uppercase;
            }
            .image-section {
                flex: 1;
                margin: 25px -60px;
                position: relative;
                overflow: hidden;
                min-height: 150px;
            }
            .image-section img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: brightness(0.5) saturate(0.8);
            }
            .image-overlay {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(180deg, #1c1917 0%, transparent 30%, transparent 70%, #000 100%);
            }
            .footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 20px;
                border-top: 2px solid rgba(255,255,255,0.1);
            }
            .footer-left { display: flex; align-items: center; gap: 15px; }
            .footer-logo { width: 70px; height: 70px; object-fit: contain; border-radius: 10px; background: rgba(255,255,255,0.1); padding: 6px; }
            .footer-info { display: flex; flex-direction: column; gap: 4px; }
            .advogado { color: white; font-size: 24px; font-weight: 600; }
            .oab { color: #dc2626; font-size: 18px; }
            .cta-text { color: #dc2626; font-size: 20px; font-weight: 600; }
        </style></head><body>
        <div class="story">
            <div class="header">
                ${logo ? `<img src="${logo}" class="header-logo" />` : '<div></div>'}
                <div class="alert-badge">URGENTE</div>
            </div>
            <div class="headline">${alerta}</div>
            ${prazo ? `
            <div class="prazo-box">
                <div class="prazo-label">Prazo</div>
                <div class="prazo-valor">${prazo}</div>
            </div>
            ` : ''}
            <div class="risco-box">
                ${riscoHTML}
            </div>
            <div class="cta-urgente">${acao}</div>
            <div class="image-section">
                <img src="${imageUrl}" alt="" />
                <div class="image-overlay"></div>
            </div>
            <div class="footer">
                <div class="footer-left">
                    ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                    <div class="footer-info">
                        <div class="advogado">${nomeAdvogado}</div>
                        ${oab ? `<div class="oab">${oab}</div>` : ''}
                    </div>
                </div>
                <div class="cta-text">Não perca o prazo! ↑</div>
            </div>
        </div>
        </body></html>`;
    }

    // ========================================
    // TEMPLATE: PREMIUM
    // ========================================
    if (template === 'premium') {
        const insight = data.insight || resposta || '';
        const dica = data.dica || '';

        // Imagem de fundo: stock ou IA
        const areaLower = (area || '').toLowerCase();
        let imageUrl;
        if (tipoImagem === 'ia') {
            const areaPrompts = {
                'trabalhista': 'luxury executive office, premium business environment, elegant corporate meeting room, golden tones',
                'trabalho': 'luxury executive office, premium business environment, elegant corporate meeting room, golden tones',
                'penal': 'elegant courthouse interior, premium legal environment, sophisticated law office, marble columns',
                'criminal': 'elegant courthouse interior, premium legal environment, sophisticated law office, marble columns',
                'consumidor': 'premium retail experience, luxury shopping, elegant consumer service, high-end store',
                'tributário': 'luxury financial office, premium wealth management, elegant banking, gold and marble',
                'tributario': 'luxury financial office, premium wealth management, elegant banking, gold and marble',
                'família': 'elegant family home, luxury estate, premium residential, warm sophisticated interior',
                'familia': 'elegant family home, luxury estate, premium residential, warm sophisticated interior',
                'default': 'premium law office, elegant legal environment, luxury corporate, sophisticated professional, golden tones'
            };
            let basePrompt = areaPrompts.default;
            for (const [key, value] of Object.entries(areaPrompts)) {
                if (areaLower.includes(key)) { basePrompt = value; break; }
            }
            const imagePrompt = encodeURIComponent(`${basePrompt}, high quality, professional photography, no text, no watermark`);
            imageUrl = `https://image.pollinations.ai/prompt/${imagePrompt}?width=1080&height=400&nologo=true`;
        } else {
            imageUrl = getStockImage(area);
        }

        return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}
        <style>
            .story {
                width: 1080px;
                height: 1920px;
                background: linear-gradient(180deg, ${corFundo} 0%, #16213e 60%, #000 100%);
                padding: 60px;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .header-logo {
                width: 110px;
                height: 110px;
                object-fit: contain;
                border-radius: 16px;
                background: rgba(255,255,255,0.1);
                padding: 10px;
                border: 2px solid ${corSecundaria}30;
            }
            .badge {
                background: linear-gradient(135deg, ${corSecundaria}, #b8962e);
                color: ${corFundo};
                font-size: 18px;
                font-weight: 700;
                padding: 12px 24px;
                border-radius: 50px;
                text-transform: uppercase;
                letter-spacing: 3px;
            }
            .brand-name {
                font-family: 'Playfair Display', serif;
                font-size: 32px;
                color: white;
                margin-bottom: 10px;
            }
            .divider {
                width: 100px;
                height: 4px;
                background: linear-gradient(90deg, ${corSecundaria}, transparent);
                margin-bottom: 30px;
            }
            .area-tag {
                color: ${corSecundaria};
                font-size: 22px;
                text-transform: uppercase;
                letter-spacing: 5px;
                margin-bottom: 15px;
            }
            .headline {
                font-family: 'Playfair Display', serif;
                font-size: 46px;
                color: white;
                line-height: 1.25;
                margin-bottom: 30px;
            }
            .content-box {
                background: rgba(${corSecundaria === '#d4af37' ? '212,175,55' : '30,58,95'},0.1);
                border: 1px solid ${corSecundaria}30;
                border-left: 5px solid ${corSecundaria};
                border-radius: 0 20px 20px 0;
                padding: 35px;
                margin-bottom: 20px;
            }
            .content-box p {
                color: rgba(255,255,255,0.95);
                font-size: 28px;
                line-height: 1.5;
                margin: 0;
            }
            .dica-box {
                background: rgba(255,255,255,0.05);
                border-radius: 16px;
                padding: 25px 30px;
                margin-bottom: 20px;
            }
            .dica-text {
                color: rgba(255,255,255,0.85);
                font-size: 24px;
                line-height: 1.4;
            }
            .cta-button {
                background: linear-gradient(135deg, ${corSecundaria}, #b8962e);
                color: ${corFundo};
                padding: 24px 40px;
                border-radius: 14px;
                text-align: center;
                font-weight: 800;
                font-size: 24px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            .image-section {
                flex: 1;
                margin: 25px -60px;
                position: relative;
                overflow: hidden;
                min-height: 180px;
            }
            .image-section img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                filter: brightness(0.6) saturate(0.9);
            }
            .image-overlay {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(180deg, #16213e 0%, transparent 30%, transparent 70%, #000 100%);
            }
            .footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding-top: 20px;
                border-top: 2px solid ${corSecundaria}30;
            }
            .footer-left { display: flex; align-items: center; gap: 15px; }
            .footer-logo { width: 75px; height: 75px; object-fit: contain; border-radius: 12px; background: rgba(255,255,255,0.1); padding: 6px; }
            .footer-info { display: flex; flex-direction: column; gap: 4px; }
            .advogado { color: white; font-size: 24px; font-weight: 600; }
            .oab { color: ${corSecundaria}; font-size: 18px; }
            .cta-text { color: ${corSecundaria}; font-size: 20px; font-weight: 600; }
        </style></head><body>
        <div class="story">
            <div class="header">
                ${logo ? `<img src="${logo}" class="header-logo" />` : '<div></div>'}
                <div class="badge">Premium</div>
            </div>
            <div class="brand-name">${nomeAdvogado || 'Advocacia'}</div>
            <div class="divider"></div>
            <div class="area-tag">${area}</div>
            <div class="headline">${headline}</div>
            <div class="content-box">
                <p>${insight}</p>
            </div>
            ${dica ? `
            <div class="dica-box">
                <div class="dica-text">${dica}</div>
            </div>
            ` : ''}
            <div class="cta-button">${cta || 'AGENDE SUA CONSULTA'}</div>
            <div class="image-section">
                <img src="${imageUrl}" alt="" />
                <div class="image-overlay"></div>
            </div>
            <div class="footer">
                <div class="footer-left">
                    ${logo ? `<img src="${logo}" class="footer-logo" />` : ''}
                    <div class="footer-info">
                        <div class="advogado">${nomeAdvogado}</div>
                        ${oab ? `<div class="oab">${oab}</div>` : ''}
                    </div>
                </div>
                <div class="cta-text">Siga para mais conteúdo ↑</div>
            </div>
        </div>
        </body></html>`;
    }

    throw new Error('Template nao encontrado: ' + template);
}

app.listen(PORT, function() {
    console.log('=================================');
    console.log('🎨 Puppeteer Stories v4 - AUTO-RECOVERY');
    console.log('=================================');
    console.log('✅ Porta:', PORT);
    console.log('🔄 protocolTimeout: 60s');
    console.log('🛡️ Auto-recovery: ATIVO');
    console.log('🖼️ Templates: PROFISSIONAIS');
    console.log('=================================');
});
