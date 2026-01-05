const express = require('express');
const cors = require('cors');
const { createCanvas, loadImage } = require('canvas');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Arquivo para armazenar trending topics
const TRENDING_FILE = path.join(__dirname, 'trending-topics.json');

// CORS configurado para produção
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Cloudinary configurado via variáveis de ambiente
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dgf3hzmb8',
  api_key: process.env.CLOUDINARY_API_KEY || '239768197523983',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'PVPOJkaWTJcMIJn5Nsn-_h9BWJk'
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'JurisContent Backend v1.1 - Stories',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ================================================
// ROTA: GERAR STORY (Nova!)
// ================================================
// Helper para extração inteligente de conteúdo para Stories
function parseStoryContent(texto, tema, template) {
  const lines = texto.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const data = {
    pergunta: tema.includes('?') ? tema : '',
    resposta: texto,
    bullets: [],
    estatistica: { valor: '', label: '', descricao: '' },
    dica: '',
    headline: tema
  };

  // 1. Tentar encontrar pergunta se não houver no tema
  if (!data.pergunta) {
    const qLine = lines.find(l => l.endsWith('?'));
    if (qLine) data.pergunta = qLine;
  }

  // 2. Extrair Bullets (para templates de lista ou urgência)
  const bulletLines = lines.filter(l => /^[-*•✓]|\d+\.|\d+\)/.test(l));
  if (bulletLines.length > 0) {
    data.bullets = bulletLines.map(l => {
      const parts = l.replace(/^[-*•✓]|\d+\.|\d+\)/, '').trim().split(':');
      return {
        titulo: parts.length > 1 ? parts[0].trim() : '•',
        descricao: parts.length > 1 ? parts[1].trim() : parts[0].trim(),
        texto: l.replace(/^[-*•✓]|\d+\.|\d+\)/, '').trim() // Versão simples
      };
    });
  }

  // 3. Extrair Estatística / Números de impacto
  const statMatch = texto.match(/(\d+%|\d+x|\d+\s+anos|\d+\s+meses|R\$\s?[\d.,]+)/i);
  if (statMatch) {
    data.estatistica.valor = statMatch[0].toUpperCase();
    // Tentar pegar o contexto ao redor do número
    const sentence = lines.find(l => l.includes(statMatch[0]));
    if (sentence) {
      data.estatistica.label = sentence.replace(statMatch[0], '').trim().substring(0, 30);
      data.estatistica.descricao = sentence.trim();
    }
  }

  // 4. Extrair Dica
  const dicaLine = lines.find(l => l.toLowerCase().startsWith('dica:'));
  if (dicaLine) {
    data.dica = dicaLine.replace(/dica:/i, '').trim();
  }

  // 5. Limpar a Resposta (remover a pergunta do início se duplicada)
  if (data.pergunta && data.resposta.startsWith(data.pergunta)) {
    data.resposta = data.resposta.replace(data.pergunta, '').trim();
  }

  // 6. Se tiver bullets, remover as linhas de bullets da resposta para evitar repetição
  if (data.bullets.length > 0) {
    const linesSemBullets = lines.filter(l => !bulletLines.includes(l) && !l.includes(data.pergunta));
    data.resposta = linesSemBullets.join(' ').trim();
  }

  // Se for o template 'voce-sabia'
  if (template === 'voce-sabia') {
    data.destaque = 'LEI EM PRIMEIRO LUGAR!';
    // Se a resposta estiver vazia após tirar a pergunta, tentar pegar a primeira frase relevante
    if (!data.pergunta && lines.length > 0) {
      data.pergunta = lines[0];
      data.resposta = lines.slice(1).join('\n');
    }
  }

  return data;
}

app.post('/api/gerar-story', async (req, res) => {
  try {
    const { texto, tema, area, template, perfil_visual, nome_advogado, oab, telefone, instagram } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template obrigatório' });
    }

    console.log('📱 Gerando Story:', { template, area, tema });

    // Extração inteligente de conteúdo
    const content = parseStoryContent(texto || '', tema || '', template);

    // Chamar Puppeteer Stories Service
    const PUPPETEER_URL = 'http://localhost:3002/render-story';

    // Preparar dados para o Puppeteer
    const storyData = {
      template,
      data: {
        corPrimaria: perfil_visual?.cor_primaria || '#1e3a5f',
        corSecundaria: perfil_visual?.cor_secundaria || '#d4af37',
        corFundo: '#0d1b2a',
        pergunta: content.pergunta || tema || 'Você sabia?',
        resposta: content.resposta,
        destaque: content.destaque || 'SAIBA SEUS DIREITOS!',
        headline: content.headline || tema || '',
        area: area || '',
        nomeAdvogado: nome_advogado || '',
        oab: oab || '',
        telefone: telefone || '',
        instagram: instagram || '',
        iniciais: nome_advogado ? nome_advogado.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '',
        cta: 'Arraste para saber mais',
        bullets: content.bullets,
        estatistica: content.estatistica,
        dica: content.dica
      }
    };

    const response = await fetch(PUPPETEER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storyData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Puppeteer erro: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.success || !data.image) {
      throw new Error('Falha ao gerar imagem do Story');
    }

    // Upload para Cloudinary
    console.log('📤 Upload Story para Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(data.image, {
      folder: 'juridico-stories',
      format: 'png'
    });

    console.log('✅ Story gerado:', uploadResult.secure_url);

    res.json({
      success: true,
      imageUrl: uploadResult.secure_url,
      template: template,
      renderTimeMs: data.renderTimeMs
    });

  } catch (error) {
    console.error('❌ Erro gerar story:', error);
    res.status(500).json({
      error: 'Erro ao gerar story',
      details: error.message
    });
  }
});

// ================================================
// ROTA: GERAR STORY COM IA (via N8N)
// ================================================
app.post('/api/gerar-story-ia', async (req, res) => {
  try {
    const { texto, tema, area, template, perfil_visual, nome_advogado, oab, telefone, instagram } = req.body;

    console.log('🤖 Gerando Story com IA:', { template, area });

    const N8N_URL = 'http://localhost:5678/webhook/juridico-stories';

    const response = await fetch(N8N_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto, tema, area, template, perfil_visual,
        nome_advogado, oab, telefone, instagram
      })
    });

    if (!response.ok) {
      throw new Error(`N8N erro: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.image) {
      throw new Error('Falha ao gerar story via IA');
    }

    // Upload para Cloudinary
    const uploadResult = await cloudinary.uploader.upload(data.image, {
      folder: 'juridico-stories',
      format: 'png'
    });

    console.log('✅ Story IA gerado:', uploadResult.secure_url);

    res.json({
      success: true,
      imageUrl: uploadResult.secure_url,
      template: template
    });

  } catch (error) {
    console.error('❌ Erro story IA:', error);
    res.status(500).json({
      error: 'Erro ao gerar story com IA',
      details: error.message
    });
  }
});

// ================================================
// ROTA: SALVAR TRENDING TOPICS (do N8N)
// ================================================
app.post('/api/trending-topics', (req, res) => {
  try {
    const { trending, dataAtualizacao } = req.body;

    if (!trending || !Array.isArray(trending)) {
      return res.status(400).json({ error: 'Dados de trending inválidos' });
    }

    const dados = {
      trending: trending.slice(0, 3),
      dataAtualizacao: dataAtualizacao || new Date().toISOString(),
      ultimaAtualizacao: new Date().toISOString()
    };

    fs.writeFileSync(TRENDING_FILE, JSON.stringify(dados, null, 2));
    console.log('✅ Trending topics salvos:', dados.trending.length, 'temas');

    res.json({
      success: true,
      message: 'Trending topics atualizados',
      count: dados.trending.length
    });
  } catch (error) {
    console.error('❌ Erro ao salvar trending:', error);
    res.status(500).json({
      error: 'Erro ao salvar trending topics',
      details: error.message
    });
  }
});

app.get('/api/trending-topics', (req, res) => {
  try {
    if (fs.existsSync(TRENDING_FILE)) {
      const dados = JSON.parse(fs.readFileSync(TRENDING_FILE, 'utf-8'));
      const dataHoje = new Date().toISOString().split('T')[0];
      const dataArquivo = dados.ultimaAtualizacao?.split('T')[0];

      if (dataArquivo === dataHoje) {
        return res.json(dados);
      }
    }

    res.json({
      trending: [
        { tema: "Direitos do Consumidor em 2025", descricao: "Novas regras para compras online", area: "Direito do Consumidor", icone: "🛒" },
        { tema: "Reforma Trabalhista", descricao: "Impactos nas relações de trabalho", area: "Direito Trabalhista", icone: "💼" },
        { tema: "LGPD e Proteção de Dados", descricao: "Multas e adequação das empresas", area: "Direito Digital", icone: "🔐" }
      ],
      dataAtualizacao: new Date().toISOString(),
      isFallback: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar trending topics' });
  }
});

app.post('/api/analisar-logo', async (req, res) => {
  try {
    const { logo } = req.body;
    if (!logo) return res.status(400).json({ error: 'Logo obrigatória' });

    const response = await fetch('http://localhost:5678/webhook/analisar-logo-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logo })
    });

    if (!response.ok) throw new Error(`N8N erro: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao analisar logo', details: error.message });
  }
});

app.post('/api/gerar-conteudo', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

    const response = await fetch('http://localhost:5678/webhook/juridico-working', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) throw new Error(`N8N erro: ${response.status}`);
    const data = await response.json();
    res.json({ content: data.content || data.texto || '' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar conteúdo', details: error.message });
  }
});

app.post('/api/gerar-prompt-imagem', async (req, res) => {
  try {
    const { tema, area, estilo, formato, texto, perfil_visual } = req.body;

    const response = await fetch('http://localhost:5678/webhook/juridico-hibrido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tema, area, estilo, formato, texto, perfil_visual })
    });

    if (!response.ok) throw new Error(`N8N erro: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar prompt', details: error.message });
  }
});

app.post('/api/gerar-imagem', async (req, res) => {
  try {
    const { imageUrl, tema, area, nomeAdvogado, oab, formato, estilo, logo, bullet1 } = req.body;

    if (!imageUrl) return res.status(400).json({ error: 'URL da imagem obrigatória' });

    const paletas = {
      classico: { text: '#FFFFFF', accent: '#D4AF37' },
      moderno: { text: '#FFFFFF', accent: '#FACC15' },
      executivo: { text: '#FFFFFF', accent: '#C9A050' },
      acolhedor: { text: '#FFFFFF', accent: '#FFB366' }
    };
    const cores = paletas[estilo] || paletas.classico;

    const dimensoes = {
      quadrado: { w: 1080, h: 1080 },
      stories: { w: 1080, h: 1920 },
      landscape: { w: 1920, h: 1080 }
    };
    const dim = dimensoes[formato] || dimensoes.quadrado;

    const canvas = createCanvas(dim.w, dim.h);
    const ctx = canvas.getContext('2d');

    const baseImage = await loadImage(imageUrl);
    ctx.drawImage(baseImage, 0, 0, dim.w, dim.h);

    const gradTopo = ctx.createLinearGradient(0, 0, 0, dim.h * 0.35);
    gradTopo.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    gradTopo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradTopo;
    ctx.fillRect(0, 0, dim.w, dim.h * 0.4);

    const gradRodape = ctx.createLinearGradient(0, dim.h * 0.7, 0, dim.h);
    gradRodape.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradRodape.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    ctx.fillStyle = gradRodape;
    ctx.fillRect(0, dim.h * 0.65, dim.w, dim.h * 0.35);

    function fillTextWithShadow(text, x, y) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 15;
      ctx.fillText(text, x, y);
      ctx.shadowColor = 'transparent';
    }

    if (area) {
      ctx.fillStyle = cores.accent;
      ctx.font = 'bold 28px Arial';
      ctx.textAlign = 'center';
      fillTextWithShadow(area.toUpperCase(), dim.w / 2, 60);
    }

    if (tema) {
      ctx.fillStyle = cores.text;
      ctx.font = 'bold italic 48px Georgia';
      ctx.textAlign = 'center';
      fillTextWithShadow(tema, dim.w / 2, 140);
    }

    if (nomeAdvogado) {
      ctx.fillStyle = cores.accent;
      ctx.font = 'bold 34px Arial';
      fillTextWithShadow(nomeAdvogado, dim.w / 2, dim.h - 100);
    }

    if (oab) {
      ctx.fillStyle = cores.text;
      ctx.font = '24px Arial';
      fillTextWithShadow(oab, dim.w / 2, dim.h - 60);
    }

    if (logo) {
      try {
        const logoBase64 = logo.startsWith('data:') ? logo : `data:image/png;base64,${logo}`;
        const logoImage = await loadImage(logoBase64);
        ctx.drawImage(logoImage, dim.w - 120, 30, 80, 80);
      } catch (e) { }
    }

    const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: 'juridico-final',
      format: 'jpg'
    });

    res.json({ success: true, imageUrl: uploadResult.secure_url });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar imagem', details: error.message });
  }
});

app.post('/api/remover-fundo', async (req, res) => {
  try {
    let { logo } = req.body;
    if (!logo) return res.status(400).json({ success: false, error: 'Logo não fornecida' });

    if (logo.includes(',')) logo = logo.split(',')[1];

    const https = require('https');
    const querystring = require('querystring');

    const postData = querystring.stringify({
      image_file_b64: logo,
      size: 'auto',
      format: 'png'
    });

    const options = {
      hostname: 'api.remove.bg',
      path: '/v1.0/removebg',
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.REMOVEBG_API_KEY || 'cz67CSF3ZrSWHxhXuvWzVgTz',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const apiRequest = https.request(options, (apiResponse) => {
      const chunks = [];
      apiResponse.on('data', (chunk) => chunks.push(chunk));
      apiResponse.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (apiResponse.statusCode === 200) {
          res.json({ success: true, logoSemFundo: buffer.toString('base64'), mimeType: 'image/png' });
        } else {
          res.status(apiResponse.statusCode).json({ success: false, error: 'Erro na API' });
        }
      });
    });

    apiRequest.on('error', (error) => res.status(500).json({ success: false, error: error.message }));
    apiRequest.write(postData);
    apiRequest.end();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const http = require("http");

app.all("/api/n8n/*", (req, res) => {
  const n8nPath = req.path.replace("/api/n8n", "");
  const options = {
    hostname: "localhost",
    port: 5678,
    path: n8nPath,
    method: req.method,
    headers: { "Content-Type": "application/json" }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => res.status(500).json({ error: "Erro n8n" }));
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body) {
    proxyReq.write(JSON.stringify(req.body));
  }
  proxyReq.end();
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 Backend v1.1 - Stories Ready');
  console.log('=================================');
  console.log('✅ Porta:', PORT);
  console.log('📱 Stories: ATIVO');
  console.log('=================================');
});
