const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createCanvas, loadImage, registerFont } = require('canvas');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ================================================
// SUPABASE - AUTENTICAÇÃO
// ================================================
const { createClient } = require('@supabase/supabase-js');

// Cliente com Service Key (bypassa RLS - para operações de backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Middleware de autenticação
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const token = authHeader.split(' ')[1];
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Erro auth:', error.message);
    return res.status(401).json({ error: 'Erro na autenticação' });
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

const TRENDING_FILE = path.join(__dirname, 'trending-topics.json');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
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

// ================================================
// SEGURANÇA - Headers e Rate Limiting
// ================================================
// Helmet - adiciona headers de segurança
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para permitir inline scripts do React
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting - proteção contra brute-force e DDoS
const limiterGeral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

const limiterGeracaoConteudo = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 gerações por minuto
  message: { error: 'Limite de gerações atingido. Aguarde 1 minuto.' }
});

const limiterPagamentos = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 tentativas por minuto
  message: { error: 'Muitas tentativas de pagamento. Aguarde 1 minuto.' }
});

// Aplicar rate limit geral
app.use('/api/', limiterGeral);

// Cloudinary - credenciais APENAS via variáveis de ambiente
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ ERRO: Credenciais Cloudinary não configuradas no .env');
}
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

app.get('/', (req, res) => {
  res.json({
    status: 'JurisContent Backend v2.0 - IA Integrada',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ================================================
// FUNÇÕES AUXILIARES PARA CANVAS
// ================================================
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawTextWithShadow(ctx, text, x, y, shadowColor = 'rgba(0,0,0,0.8)', shadowBlur = 10) {
  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ================================================
// FUNÇÃO: Caixa Premium com Gradiente e Borda
// ================================================
function drawPremiumBox(ctx, x, y, width, height, options = {}) {
  const {
    radius = 24,
    opacity = 0.85,
    gradient = true,
    borderColor = 'rgba(212, 175, 55, 0.4)',
    borderWidth = 2,
    shadowBlur = 20,
    style = 'default' // 'default', 'accent', 'subtle'
  } = options;

  ctx.save();

  // Sombra externa
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  // Fundo com gradiente
  if (gradient) {
    const grad = ctx.createLinearGradient(x, y, x, y + height);
    if (style === 'accent') {
      grad.addColorStop(0, `rgba(30, 58, 95, ${opacity})`);
      grad.addColorStop(1, `rgba(13, 27, 42, ${opacity + 0.1})`);
    } else if (style === 'subtle') {
      grad.addColorStop(0, `rgba(20, 20, 25, ${opacity - 0.1})`);
      grad.addColorStop(1, `rgba(10, 10, 15, ${opacity})`);
    } else {
      grad.addColorStop(0, `rgba(15, 23, 42, ${opacity})`);
      grad.addColorStop(1, `rgba(5, 10, 20, ${opacity + 0.1})`);
    }
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = `rgba(10, 15, 25, ${opacity})`;
  }

  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();

  // Borda dourada sutil
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.stroke();

  ctx.restore();
}

// Função legada para compatibilidade
function drawDarkBox(ctx, x, y, width, height, radius = 20, opacity = 0.75) {
  drawPremiumBox(ctx, x, y, width, height, { radius, opacity, gradient: true });
}

function drawMultilineText(ctx, lines, x, y, lineHeight, align = 'center') {
  ctx.textAlign = align;
  for (let i = 0; i < lines.length; i++) {
    drawTextWithShadow(ctx, lines[i], x, y + (i * lineHeight));
  }
}

// ================================================
// FUNÇÃO: Gerar conteúdo via IA (n8n)
// ================================================
async function gerarConteudoIA(texto, tema, area, template) {
  const prompts = {
    'voce-sabia': `TAREFA: Criar conteúdo EDUCATIVO para Instagram Story jurídico.

TEMA: ${tema}
ÁREA: ${area}
CONTEXTO: ${texto}

FORMATO OBRIGATÓRIO - Retorne EXATAMENTE este JSON:
{
  "pergunta": "Pergunta que desperta curiosidade (6-10 palavras)",
  "topicos": [
    "O QUE É: Definição clara e simples do conceito",
    "QUEM TEM DIREITO: Quem pode se beneficiar ou está protegido",
    "COMO FUNCIONA: Explicação prática do processo ou procedimento",
    "PRAZO IMPORTANTE: Prazos legais, prescrição ou tempo limite",
    "ATENÇÃO: Erro comum ou armadilha que as pessoas cometem"
  ],
  "conclusao": "Frase motivacional de empoderamento (50-70 chars)",
  "dica": "Conselho prático que a pessoa pode aplicar hoje",
  "destaque": "PROTEJA SEUS DIREITOS!"
}

REGRAS IMPORTANTES:
1. Cada tópico deve ensinar algo ÚTIL e ESPECÍFICO sobre "${tema}"
2. Use linguagem simples - o público não é advogado
3. Inclua números, prazos ou dados quando relevante
4. Cada tópico: 60-90 caracteres (informativo mas conciso)
5. EXATAMENTE 5 tópicos no array
6. NÃO use emojis
7. Retorne APENAS o JSON

JSON:`,

    'estatistica': `Você é um especialista em marketing jurídico para Instagram Stories.

CONTEÚDO ORIGINAL: ${texto}
TEMA: ${tema}
ÁREA: ${area}

INSTRUÇÕES:
1. NÚMERO: Use estatística REAL e VARIADA (não sempre 80%). Pode ser: porcentagem (45%, 67%), valor (R$ 5.000), tempo (5 anos), quantidade (3 em cada 10)
2. CONTEXTO: Frase curta explicando o número (5-8 palavras)
3. EXPLICAÇÃO: Texto informativo de 3-4 frases (250-350 caracteres). Explique o impacto, as consequências e o que o leitor deve saber.

Retorne APENAS este JSON:
{"headline":"Título impactante (8-12 palavras)","estatistica":{"numero":"DADO VARIADO","contexto":"O que representa (5-8 palavras)","explicacao":"Texto completo com 3-4 frases explicando o contexto, impacto e importância. Mínimo 250 caracteres. Seja informativo e direto."}}`,

    'urgente': `Você é um advogado especialista em ${area} criando um Story de ALERTA URGENTE para Instagram.

TEMA: ${tema}
ÁREA: ${area}
CONTEXTO: ${texto}

CRIE um alerta jurídico que gere URGÊNCIA e mostre que o leitor pode PERDER DIREITOS se não agir.

FORMATO OBRIGATÓRIO (JSON):
{
  "alerta": "ATENÇÃO: [frase urgente de 8-12 palavras sobre ${tema}]",
  "prazo": "[prazo legal específico, ex: '2 anos', '5 anos', '30 dias', '90 dias'. Se não souber, use '']",
  "risco": "[CONSEQUÊNCIAS graves em 3 frases curtas separadas por ponto. Ex: Você pode perder o direito de cobrar. O valor prescrito não pode ser recuperado. Milhares de trabalhadores já perderam esse direito.]",
  "acao": "CONSULTE UM ADVOGADO ESPECIALISTA EM ${area.toUpperCase()}"
}

REGRAS:
- O campo "alerta" DEVE começar com "ATENÇÃO:" ou "CUIDADO:" ou "URGENTE:"
- O campo "risco" deve ter EXATAMENTE 3 frases curtas e diretas (cada uma com 15-25 palavras), separadas por ponto
- O campo "risco" deve mencionar CONSEQUÊNCIAS REAIS: perda de direito, prescrição, multa, prejuízo financeiro
- NÃO use emojis
- Retorne APENAS o JSON, sem explicação`,

  };

  const prompt = prompts[template] || prompts['voce-sabia'];

  try {
    console.log('🤖 Chamando IA para template:', template);
    
    const response = await fetch('http://localhost:5678/webhook/juridico-working', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`N8N erro: ${response.status}`);
    }

    const data = await response.json();
    const textoIA = data.content || '';
    
    console.log('📝 Resposta IA:', textoIA.substring(0, 300));

    // Extrair JSON
    const jsonMatch = textoIA.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('✅ JSON parseado:', JSON.stringify(parsed).substring(0, 200));
      return parsed;
    }
    
    throw new Error('JSON não encontrado');
  } catch (error) {
    console.log('⚠️ Erro IA:', error.message);
    return null;
  }
}

// ================================================
// FUNÇÃO: Fallback quando IA falha
// ================================================
function criarFallback(template, texto, tema) {
  const textoLimpo = (texto || '').substring(0, 180);
  
  return {
    pergunta: tema || 'Informação Jurídica',
    resposta: textoLimpo,
    destaque: 'CONHEÇA SEUS DIREITOS',
    headline: tema || 'Informação Jurídica',
    bullets: [],
    estatistica: { numero: '', contexto: '', explicacao: '' },
    cta: 'Siga para mais dicas'
  };
}

// ================================================
// ROTA: GERAR STORY (com IA integrada)
// ================================================
// ================================================
// FUNÇÃO: Obter data/hora no timezone de São Paulo
// ================================================
function getDataSaoPaulo() {
  return new Date().toLocaleString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function getMesAtualSaoPaulo() {
  const data = new Date().toLocaleString('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit'
  });
  // Formato: YYYY-MM
  return data.slice(0, 7);
}

// ================================================
// FUNÇÃO: Verificar expiração de assinatura
// ================================================
async function verificarExpiracaoAssinatura(userId) {
  try {
    const { data: assinatura } = await supabase
      .from('assinaturas')
      .select('id, data_fim, status')
      .eq('user_id', userId)
      .eq('status', 'ativa')
      .single();

    if (!assinatura) return null;

    const agora = new Date();
    const dataFim = new Date(assinatura.data_fim);

    // Se a assinatura expirou
    if (dataFim < agora) {
      console.log('⏰ Assinatura expirada para user:', userId);

      // Marcar como expirada
      await supabase
        .from('assinaturas')
        .update({
          status: 'expirada',
          cancelada_em: new Date().toISOString(),
          motivo_cancelamento: 'Expiração automática'
        })
        .eq('id', assinatura.id);

      // Voltar para plano grátis
      await supabase
        .from('perfis')
        .update({ plano_atual: 'gratis' })
        .eq('id', userId);

      console.log('⚠️ Usuário voltou para plano grátis');
      return 'expirada';
    }

    return 'ativa';
  } catch (error) {
    console.error('Erro ao verificar expiração:', error);
    return null;
  }
}

// ================================================
// FUNÇÃO: Verificar e incrementar limite de gerações
// ================================================
async function verificarEIncrementarLimite(userId) {
  try {
    // Primeiro, verificar se assinatura expirou
    await verificarExpiracaoAssinatura(userId);

    // Buscar perfil (após possível atualização de expiração)
    const { data: perfil } = await supabase
      .from('perfis')
      .select('geracoes_mes, mes_referencia, plano_atual')
      .eq('id', userId)
      .single();

    const mesAtual = getMesAtualSaoPaulo(); // Timezone São Paulo
    let geracoesUsadas = perfil?.geracoes_mes || 0;

    // Resetar se mudou o mês
    if (perfil?.mes_referencia !== mesAtual) {
      geracoesUsadas = 0;
    }

    // Buscar limite do plano (já atualizado se expirou)
    const planoSlug = perfil?.plano_atual || 'gratis';
    const { data: plano } = await supabase
      .from('planos')
      .select('limite_geracoes')
      .eq('slug', planoSlug)
      .single();

    const limite = plano?.limite_geracoes ?? 3;

    // Verificar se pode gerar (0 = ilimitado)
    if (limite > 0 && geracoesUsadas >= limite) {
      return {
        permitido: false,
        limite,
        usado: geracoesUsadas,
        restante: 0,
        plano: planoSlug
      };
    }

    // Incrementar contador
    await supabase
      .from('perfis')
      .upsert({
        id: userId,
        geracoes_mes: geracoesUsadas + 1,
        mes_referencia: mesAtual,
        plano_atual: planoSlug
      }, { onConflict: 'id' });

    return {
      permitido: true,
      limite,
      usado: geracoesUsadas + 1,
      restante: limite === 0 ? -1 : limite - (geracoesUsadas + 1),
      plano: planoSlug
    };
  } catch (error) {
    console.error('Erro ao verificar limite:', error);
    // Em caso de erro, permite (fail-open)
    return { permitido: true, limite: 3, usado: 0, restante: 3, plano: 'gratis' };
  }
}

// ================================================
// ROTA: GERAR CONTEÚDO STORY (só IA, sem renderizar)
// ================================================
app.post('/api/gerar-conteudo-story', limiterGeracaoConteudo, authMiddleware, async (req, res) => {
  try {
    const { texto, tema, area, template } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template obrigatório' });
    }

    // Verificar limite de gerações
    const limiteCheck = await verificarEIncrementarLimite(req.user.id);
    if (!limiteCheck.permitido) {
      return res.status(403).json({
        error: 'Limite de gerações atingido',
        limite: limiteCheck.limite,
        usado: limiteCheck.usado,
        plano: limiteCheck.plano,
        upgrade_url: `${process.env.APP_URL}/planos`
      });
    }

    console.log('🤖 Gerando conteúdo IA para edição:', { template, area, tema, limite: limiteCheck });

    let dadosProcessados = await gerarConteudoIA(texto, tema, area, template);

    if (!dadosProcessados) {
      console.log('⚠️ Usando fallback');
      dadosProcessados = criarFallback(template, texto, tema);
    }

    console.log('✅ Conteúdo gerado para edição:', JSON.stringify(dadosProcessados));
    res.json({ success: true, conteudo: dadosProcessados });

  } catch (error) {
    console.error('❌ Erro gerar conteúdo:', error);
    res.status(500).json({ error: 'Erro ao gerar conteúdo', details: error.message });
  }
});

// ================================================
// ROTA: GERAR STORY (renderizar imagem)
// ================================================
app.post('/api/gerar-story', limiterGeracaoConteudo, authMiddleware, async (req, res) => {
  try {
    const {
      texto,
      tema,
      area,
      template,
      perfil_visual,
      nome_advogado,
      oab,
      telefone,
      instagram,
      logo,
      conteudo_editado
    } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template obrigatório' });
    }

    // Verificar limite de gerações
    const limiteCheck = await verificarEIncrementarLimite(req.user.id);
    if (!limiteCheck.permitido) {
      return res.status(403).json({
        error: 'Limite de gerações atingido',
        limite: limiteCheck.limite,
        usado: limiteCheck.usado,
        plano: limiteCheck.plano,
        upgrade_url: `${process.env.APP_URL}/planos`
      });
    }

    console.log('📱 Gerando Story:', { template, area, tema, temLogo: !!logo, editado: !!conteudo_editado, limite: limiteCheck });

    // Se veio conteúdo editado, usa direto. Senão, gera via IA
    let dadosProcessados;
    if (conteudo_editado) {
      console.log('✏️ Usando conteúdo editado pelo usuário');
      dadosProcessados = conteudo_editado;
    } else {
      dadosProcessados = await gerarConteudoIA(texto, tema, area, template);
      if (!dadosProcessados) {
        console.log('⚠️ Usando fallback');
        dadosProcessados = criarFallback(template, texto, tema);
      }
    }

    // Enviar para Puppeteer
    const PUPPETEER_URL = process.env.PUPPETEER_URL || 'http://localhost:3002/render-story';

    const storyData = {
      template,
      data: {
        corPrimaria: perfil_visual?.cor_primaria || '#1e3a5f',
        corSecundaria: perfil_visual?.cor_secundaria || '#d4af37',
        corFundo: perfil_visual?.cor_fundo || '#0d1b2a',
        nomeAdvogado: nome_advogado || '',
        oab: oab || '',
        telefone: telefone || '',
        instagram: instagram || '',
        iniciais: nome_advogado 
          ? nome_advogado.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() 
          : '',
        area: area || '',
        tema: tema || '',
        logo: logo || '',
        ...dadosProcessados
      }
    };

    console.log('🎨 Enviando para Puppeteer...');
    
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

    console.log('📤 Upload para Cloudinary...');
    const uploadResult = await cloudinary.uploader.upload(data.image, {
      folder: 'juridico-stories',
      format: 'png'
    });

    console.log('✅ Story gerado:', uploadResult.secure_url);

    res.json({
      success: true,
      imageUrl: uploadResult.secure_url,
      template: template,
      renderTimeMs: data.renderTimeMs,
      conteudo: dadosProcessados
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
// ROTA: GERAR IMAGEM FEED - DESIGN PREMIUM v2
// ================================================
app.post('/api/gerar-imagem', limiterGeracaoConteudo, authMiddleware, async (req, res) => {
  try {
    const {
      imageUrl, tema, area, nomeAdvogado, oab, instagram, formato, estilo, logo, bullets, conteudo,
      corPrimaria, corSecundaria, corAcento
    } = req.body;

    if (!imageUrl) return res.status(400).json({ error: 'URL da imagem obrigatória' });

    // Verificar limite de gerações
    const limiteCheck = await verificarEIncrementarLimite(req.user.id);
    if (!limiteCheck.permitido) {
      return res.status(403).json({
        error: 'Limite de gerações atingido',
        limite: limiteCheck.limite,
        usado: limiteCheck.usado,
        plano: limiteCheck.plano,
        upgrade_url: `${process.env.APP_URL}/planos`
      });
    }

    console.log('🖼️ Gerando imagem Feed PREMIUM:', { formato, estilo, area, limite: limiteCheck });

    // Paletas de cores melhoradas
    const paletas = {
      classico: { 
        text: '#FFFFFF', 
        accent: corSecundaria || '#D4AF37', 
        secondary: '#94A3B8',
        border: 'rgba(212, 175, 55, 0.4)'
      },
      moderno: { 
        text: '#FFFFFF', 
        accent: corSecundaria || '#FACC15', 
        secondary: '#A1A1AA',
        border: 'rgba(250, 204, 21, 0.4)'
      },
      executivo: { 
        text: '#FFFFFF', 
        accent: corSecundaria || '#C9A050', 
        secondary: '#9CA3AF',
        border: 'rgba(201, 160, 80, 0.4)'
      },
      acolhedor: { 
        text: '#FFFFFF', 
        accent: corSecundaria || '#FFB366', 
        secondary: '#D4D4D8',
        border: 'rgba(255, 179, 102, 0.4)'
      }
    };
    const cores = paletas[estilo] || paletas.classico;

    const dimensoes = {
      quadrado: { w: 1080, h: 1080 },
      stories: { w: 1080, h: 1920 },
      landscape: { w: 1200, h: 628 }
    };
    const dim = dimensoes[formato] || dimensoes.quadrado;

    const canvas = createCanvas(dim.w, dim.h);
    const ctx = canvas.getContext('2d');

    // Carregar e desenhar imagem de fundo
    const baseImage = await loadImage(imageUrl);
    ctx.drawImage(baseImage, 0, 0, dim.w, dim.h);

    const paddingH = 50;
    const topoBoxY = 40;

    // Gerar badge/tag de engajamento baseado na área
    const badges = {
      'Direito Penal': '⚖️ VOCÊ SABIA?',
      'Direito Civil': '💡 DICA JURÍDICA',
      'Direito Trabalhista': '👷 SEUS DIREITOS',
      'Direito do Consumidor': '🛒 FIQUE ATENTO',
      'Direito de Família': '👨‍👩‍👧 SAIBA MAIS',
      'Direito Tributário': '📊 IMPORTANTE',
      'Direito Empresarial': '🏢 EMPRESÁRIO',
      'Direito Previdenciário': '🏦 APOSENTADORIA',
      'default': '⚖️ INFORMAÇÃO JURÍDICA'
    };
    const badge = badges[area] || badges['default'];
    
    // Calcular tamanho do título
    ctx.font = 'bold 44px Georgia';
    const temaLines = wrapText(ctx, tema || '', dim.w - (paddingH * 2) - 60);
    const temaBoxHeight = Math.max(200, 100 + (temaLines.length * 52));
    
    // CAIXA DO TOPO - Design Premium
    drawPremiumBox(ctx, paddingH, topoBoxY, dim.w - (paddingH * 2), temaBoxHeight, {
      radius: 28,
      opacity: 0.88,
      borderColor: cores.border,
      borderWidth: 2,
      style: 'accent'
    });

    // Badge no topo (substitui área genérica)
    ctx.fillStyle = cores.accent;
    ctx.font = 'bold 26px Arial';
    ctx.textAlign = 'center';
    drawTextWithShadow(ctx, badge, dim.w / 2, topoBoxY + 48);

    // Linha decorativa abaixo do badge
    ctx.save();
    const lineGrad = ctx.createLinearGradient(dim.w/2 - 100, 0, dim.w/2 + 100, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, cores.accent);
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dim.w/2 - 120, topoBoxY + 68);
    ctx.lineTo(dim.w/2 + 120, topoBoxY + 68);
    ctx.stroke();
    ctx.restore();

    // Título/Tema principal
    if (tema) {
      ctx.fillStyle = cores.text;
      ctx.font = 'bold 44px Georgia';
      const startY = topoBoxY + 110;
      drawMultilineText(ctx, temaLines, dim.w / 2, startY, 52, 'center');
    }

    // CAIXA DO RODAPÉ - Design Premium
    const rodapeBoxHeight = 130;
    const rodapeBoxY = dim.h - rodapeBoxHeight - 40;
    
    drawPremiumBox(ctx, paddingH, rodapeBoxY, dim.w - (paddingH * 2), rodapeBoxHeight, {
      radius: 28,
      opacity: 0.90,
      borderColor: cores.border,
      borderWidth: 2,
      style: 'default'
    });

    // Nome do advogado com formatação profissional
    if (nomeAdvogado) {
      ctx.fillStyle = cores.accent;
      ctx.font = 'bold 34px Arial';
      ctx.textAlign = 'center';
      drawTextWithShadow(ctx, nomeAdvogado, dim.w / 2, rodapeBoxY + 52);
    }

    // OAB com estilo mais elegante
    if (oab) {
      ctx.fillStyle = cores.secondary;
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      drawTextWithShadow(ctx, oab, dim.w / 2, rodapeBoxY + 95);
    }

    // CAIXA DE BULLETS (se existirem)
    const bulletsArray = bullets || conteudo?.bullets || [];
    
    if (bulletsArray.length > 0) {
      const bulletBoxY = temaBoxHeight + topoBoxY + 30;
      const bulletBoxHeight = Math.min(bulletsArray.length * 75 + 50, dim.h - bulletBoxY - rodapeBoxHeight - 80);
      
      drawPremiumBox(ctx, paddingH, bulletBoxY, dim.w - (paddingH * 2), bulletBoxHeight, {
        radius: 24,
        opacity: 0.82,
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        style: 'subtle'
      });
      
      const bulletStartY = bulletBoxY + 55;
      const bulletX = paddingH + 45;
      
      bulletsArray.slice(0, 4).forEach((bullet, index) => {
        const bulletText = typeof bullet === 'string' ? bullet : bullet.texto || bullet.titulo || '';
        const y = bulletStartY + (index * 70);
        
        // Ícone do bullet com destaque
        ctx.fillStyle = cores.accent;
        ctx.font = 'bold 28px Arial';
        drawTextWithShadow(ctx, '✓', bulletX, y);
        
        // Texto do bullet
        ctx.fillStyle = cores.text;
        ctx.font = '30px Arial';
        ctx.textAlign = 'left';
        const bulletLines = wrapText(ctx, bulletText, dim.w - (paddingH * 2) - 120);
        drawTextWithShadow(ctx, bulletLines[0] || '', bulletX + 45, y);
      });
    }

    // LOGO com design melhorado
    if (logo) {
      try {
        const logoBase64 = logo.startsWith('data:') ? logo : `data:image/png;base64,${logo}`;
        const logoImage = await loadImage(logoBase64);
        
        const logoSize = 80;
        const logoX = dim.w - logoSize - 25;
        const logoY = topoBoxY + 15;
        
        // Fundo do logo com gradiente
        ctx.save();
        const logoGrad = ctx.createRadialGradient(
          logoX + logoSize/2, logoY + logoSize/2, 0,
          logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 8
        );
        logoGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
        logoGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = logoGrad;
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Borda dourada no logo
        ctx.strokeStyle = cores.border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        
        // Desenhar logo
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      } catch (e) {
        console.log('⚠️ Erro logo:', e.message);
      }
    }

    // Gerar imagem final
    const imageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    const uploadResult = await cloudinary.uploader.upload(base64Image, {
      folder: 'juridico-final',
      format: 'jpg'
    });

    console.log('✅ Imagem Feed PREMIUM gerada:', uploadResult.secure_url);
    res.json({ success: true, imageUrl: uploadResult.secure_url });
  } catch (error) {
    console.error('❌ Erro imagem:', error);
    res.status(500).json({ error: 'Erro ao gerar imagem', details: error.message });
  }
});

// ================================================
// OUTRAS ROTAS
// ================================================
app.post('/api/trending-topics', (req, res) => {
  try {
    const { trending, dataAtualizacao } = req.body;
    if (!trending || !Array.isArray(trending)) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    const dados = {
      trending: trending.slice(0, 3),
      dataAtualizacao: dataAtualizacao || new Date().toISOString(),
      ultimaAtualizacao: new Date().toISOString()
    };
    fs.writeFileSync(TRENDING_FILE, JSON.stringify(dados, null, 2));
    res.json({ success: true, count: dados.trending.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro trending', details: error.message });
  }
});

app.get('/api/trending-topics', (req, res) => {
  try {
    if (fs.existsSync(TRENDING_FILE)) {
      const dados = JSON.parse(fs.readFileSync(TRENDING_FILE, 'utf-8'));
      return res.json(dados);
    }
    res.json({
      trending: [
        { tema: "Direitos do Consumidor", descricao: "Novas regras", area: "Consumidor", icone: "🛒" },
        { tema: "Reforma Trabalhista", descricao: "Impactos", area: "Trabalhista", icone: "💼" },
        { tema: "LGPD", descricao: "Proteção de dados", area: "Digital", icone: "🔐" }
      ],
      isFallback: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro trending' });
  }
});

app.post('/api/analisar-logo', authMiddleware, async (req, res) => {
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
    res.status(500).json({ error: 'Erro logo', details: error.message });
  }
});

app.post('/api/gerar-conteudo', authMiddleware, async (req, res) => {
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
    res.status(500).json({ error: 'Erro conteúdo', details: error.message });
  }
});

app.post('/api/gerar-prompt-imagem', authMiddleware, async (req, res) => {
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
    res.status(500).json({ error: 'Erro prompt', details: error.message });
  }
});

app.post('/api/remover-fundo', authMiddleware, async (req, res) => {
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
          res.status(apiResponse.statusCode).json({ success: false, error: 'Erro API' });
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

// ================================================
// MERCADO PAGO - CONFIGURAÇÃO
// ================================================
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN
});

// ================================================
// ROTAS DE PAGAMENTO
// ================================================

// Listar planos disponíveis
app.get('/api/planos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('planos')
      .select('*')
      .eq('ativo', true)
      .order('ordem');

    if (error) throw error;

    res.json({ success: true, planos: data });
  } catch (error) {
    console.error('Erro ao buscar planos:', error);
    res.status(500).json({ error: 'Erro ao buscar planos' });
  }
});

// Verificar limite de gerações do usuário
app.get('/api/meu-limite', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .rpc('verificar_limite_geracoes', { p_user_id: userId });

    if (error) throw error;

    res.json({ success: true, limite: data });
  } catch (error) {
    console.error('Erro ao verificar limite:', error);
    res.status(500).json({ error: 'Erro ao verificar limite' });
  }
});

// Ver assinatura do usuário
app.get('/api/minha-assinatura', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Buscar assinatura ativa
    const { data: assinatura, error: errAssinatura } = await supabase
      .from('assinaturas')
      .select(`
        *,
        plano:planos(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'ativa')
      .single();

    // Buscar perfil com dados de uso
    const { data: perfil, error: errPerfil } = await supabase
      .from('perfis')
      .select('geracoes_mes, mes_referencia, plano_atual')
      .eq('id', userId)
      .single();

    // Buscar plano atual
    const planoSlug = perfil?.plano_atual || 'gratis';
    const { data: plano } = await supabase
      .from('planos')
      .select('*')
      .eq('slug', planoSlug)
      .single();

    // Resetar contador se mudou o mês
    const mesAtual = getMesAtualSaoPaulo(); // Timezone São Paulo
    let geracoesUsadas = perfil?.geracoes_mes || 0;
    if (perfil?.mes_referencia !== mesAtual) {
      geracoesUsadas = 0;
    }

    res.json({
      success: true,
      assinatura: assinatura || null,
      plano: plano || { nome: 'Grátis', slug: 'gratis', limite_geracoes: 3, preco: 0 },
      uso: {
        geracoes_usadas: geracoesUsadas,
        limite: plano?.limite_geracoes || 3,
        restante: plano?.limite_geracoes === 0 ? -1 : (plano?.limite_geracoes || 3) - geracoesUsadas
      }
    });
  } catch (error) {
    console.error('Erro ao buscar assinatura:', error);
    res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
});

// Criar checkout de assinatura
app.post('/api/criar-assinatura', limiterPagamentos, authMiddleware, async (req, res) => {
  try {
    const { plano_slug } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!plano_slug) {
      return res.status(400).json({ error: 'Plano não informado' });
    }

    // Buscar plano
    const { data: plano, error: errPlano } = await supabase
      .from('planos')
      .select('*')
      .eq('slug', plano_slug)
      .eq('ativo', true)
      .single();

    if (errPlano || !plano) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    // Se for plano grátis, apenas atualiza o perfil
    if (plano.preco === 0) {
      await supabase
        .from('perfis')
        .update({ plano_atual: 'gratis' })
        .eq('id', userId);

      return res.json({
        success: true,
        message: 'Plano grátis ativado',
        plano: plano
      });
    }

    // Criar preferência de pagamento no Mercado Pago
    const preference = new Preference(mpClient);

    const preferenceData = {
      items: [
        {
          id: plano.id,
          title: `JurisContent - Plano ${plano.nome}`,
          description: plano.descricao,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: parseFloat(plano.preco)
        }
      ],
      payer: {
        email: userEmail
      },
      back_urls: {
        success: `${process.env.APP_URL}/pagamento/sucesso`,
        failure: `${process.env.APP_URL}/pagamento/erro`,
        pending: `${process.env.APP_URL}/pagamento/pendente`
      },
      auto_return: 'approved',
      external_reference: JSON.stringify({
        user_id: userId,
        plano_id: plano.id,
        plano_slug: plano.slug
      }),
      notification_url: process.env.WEBHOOK_URL,
      statement_descriptor: 'JURISCONTENT',
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
    };

    const response = await preference.create({ body: preferenceData });

    console.log('Preferência criada:', response.id);

    res.json({
      success: true,
      preference_id: response.id,
      init_point: response.init_point, // URL do checkout
      sandbox_init_point: response.sandbox_init_point // URL de teste
    });

  } catch (error) {
    console.error('Erro ao criar assinatura:', error);
    res.status(500).json({ error: 'Erro ao criar assinatura', details: error.message });
  }
});

// Função para validar assinatura do webhook do Mercado Pago
function validarWebhookMP(req) {
  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  // Se não há webhook secret configurado, pular validação (desenvolvimento)
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.log('⚠️ MERCADOPAGO_WEBHOOK_SECRET não configurado - validação desabilitada');
    return true;
  }

  if (!xSignature || !xRequestId) {
    console.log('❌ Headers de segurança ausentes');
    return false;
  }

  try {
    // Extrair ts e v1 do header x-signature
    // Formato: ts=TIMESTAMP,v1=HASH
    const parts = xSignature.split(',');
    let ts = '';
    let v1 = '';

    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') v1 = value;
    }

    if (!ts || !v1) {
      console.log('❌ Formato de x-signature inválido');
      return false;
    }

    // Construir string de assinatura
    // Formato: id=[data.id];request-id=[x-request-id];ts=[ts];
    const dataId = req.body.data?.id || '';
    const signedTemplate = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calcular HMAC
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(signedTemplate);
    const calculatedSignature = hmac.digest('hex');

    // Comparar assinaturas
    const isValid = crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(calculatedSignature)
    );

    if (!isValid) {
      console.log('❌ Assinatura do webhook inválida');
    }

    return isValid;
  } catch (error) {
    console.error('Erro ao validar webhook:', error);
    return false;
  }
}

// Webhook do Mercado Pago
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    console.log('Webhook MP recebido:', JSON.stringify(req.body));

    // Validar assinatura do webhook
    if (!validarWebhookMP(req)) {
      console.log('❌ Webhook rejeitado - assinatura inválida');
      return res.status(401).send('Unauthorized');
    }

    const { type, data } = req.body;

    // Responder rapidamente para o MP
    res.status(200).send('OK');

    if (type === 'payment') {
      const paymentId = data.id;

      // Buscar detalhes do pagamento
      const payment = new Payment(mpClient);
      const paymentInfo = await payment.get({ id: paymentId });

      console.log('Pagamento:', paymentInfo.status, paymentInfo.id);

      // Parsear external_reference
      let externalRef = {};
      try {
        externalRef = JSON.parse(paymentInfo.external_reference || '{}');
      } catch (e) {
        console.log('Erro ao parsear external_reference');
      }

      const userId = externalRef.user_id;
      const planoId = externalRef.plano_id;
      const planoSlug = externalRef.plano_slug;

      if (!userId) {
        console.log('User ID não encontrado no external_reference');
        return;
      }

      // Mapear status do MP para status interno
      const statusMap = {
        'approved': 'aprovado',
        'pending': 'pendente',
        'in_process': 'processando',
        'rejected': 'rejeitado',
        'cancelled': 'cancelado',
        'refunded': 'estornado',
        'charged_back': 'contestado'
      };

      // Registrar pagamento
      await supabase.from('pagamentos').insert({
        user_id: userId,
        valor: paymentInfo.transaction_amount,
        mp_payment_id: paymentInfo.id.toString(),
        mp_status: paymentInfo.status,
        mp_status_detail: paymentInfo.status_detail,
        mp_payment_type: paymentInfo.payment_type_id,
        mp_payment_method: paymentInfo.payment_method_id,
        payer_email: paymentInfo.payer?.email,
        payer_name: paymentInfo.payer?.first_name,
        status: statusMap[paymentInfo.status] || 'pendente',
        processado_em: paymentInfo.status === 'approved' ? new Date().toISOString() : null
      });

      // Tratar cada status do pagamento
      switch (paymentInfo.status) {
        case 'approved':
          // Pagamento aprovado - ativar assinatura
          console.log('✅ Pagamento aprovado! Ativando plano:', planoSlug);

          const dataInicio = new Date();
          const dataFim = new Date(dataInicio);
          dataFim.setDate(dataFim.getDate() + 30);

          await supabase
            .from('assinaturas')
            .upsert({
              user_id: userId,
              plano_id: planoId,
              status: 'ativa',
              data_inicio: dataInicio.toISOString(),
              data_fim: dataFim.toISOString(),
              data_proxima_cobranca: dataFim.toISOString(),
              mp_payer_id: paymentInfo.payer?.id?.toString()
            }, {
              onConflict: 'user_id'
            });

          await supabase
            .from('perfis')
            .update({
              plano_atual: planoSlug,
              geracoes_mes: 0,
              mes_referencia: getMesAtualSaoPaulo() // Timezone São Paulo
            })
            .eq('id', userId);

          console.log('✅ Plano ativado com sucesso para user:', userId);
          break;

        case 'pending':
        case 'in_process':
          // Pagamento pendente (PIX aguardando, boleto, etc)
          console.log('⏳ Pagamento pendente:', paymentInfo.status_detail);
          // Não ativa assinatura ainda, só registrou o pagamento
          break;

        case 'rejected':
          // Pagamento rejeitado
          console.log('❌ Pagamento rejeitado:', paymentInfo.status_detail);
          // Atualizar pagamento como rejeitado
          await supabase
            .from('pagamentos')
            .update({ status: 'rejeitado' })
            .eq('mp_payment_id', paymentInfo.id.toString());
          break;

        case 'cancelled':
          // Pagamento cancelado
          console.log('🚫 Pagamento cancelado');
          await supabase
            .from('pagamentos')
            .update({ status: 'cancelado' })
            .eq('mp_payment_id', paymentInfo.id.toString());
          break;

        case 'refunded':
        case 'charged_back':
          // Estorno ou contestação - cancelar assinatura
          console.log('💸 Estorno/Contestação - cancelando assinatura');

          await supabase
            .from('assinaturas')
            .update({
              status: 'cancelada',
              cancelada_em: new Date().toISOString(),
              motivo_cancelamento: paymentInfo.status === 'refunded' ? 'Estorno solicitado' : 'Contestação de pagamento'
            })
            .eq('user_id', userId)
            .eq('status', 'ativa');

          await supabase
            .from('perfis')
            .update({ plano_atual: 'gratis' })
            .eq('id', userId);

          console.log('⚠️ Assinatura cancelada por estorno/contestação');
          break;

        default:
          console.log('⚠️ Status desconhecido:', paymentInfo.status);
      }
    }

  } catch (error) {
    console.error('Erro no webhook:', error);
  }
});

// Cancelar assinatura
app.post('/api/cancelar-assinatura', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { motivo } = req.body;

    // Buscar assinatura ativa
    const { data: assinatura, error: errAssinatura } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ativa')
      .single();

    if (errAssinatura || !assinatura) {
      return res.status(404).json({ error: 'Nenhuma assinatura ativa encontrada' });
    }

    // Atualizar assinatura como cancelada
    await supabase
      .from('assinaturas')
      .update({
        status: 'cancelada',
        cancelada_em: new Date().toISOString(),
        motivo_cancelamento: motivo || 'Cancelado pelo usuário'
      })
      .eq('id', assinatura.id);

    // Voltar para plano grátis
    await supabase
      .from('perfis')
      .update({ plano_atual: 'gratis' })
      .eq('id', userId);

    res.json({
      success: true,
      message: 'Assinatura cancelada. Você ainda pode usar até o fim do período pago.'
    });

  } catch (error) {
    console.error('Erro ao cancelar:', error);
    res.status(500).json({ error: 'Erro ao cancelar assinatura' });
  }
});

// Histórico de pagamentos
app.get('/api/meus-pagamentos', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('pagamentos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json({ success: true, pagamentos: data });
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos' });
  }
});

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
  console.log('🚀 Backend v2.1 - Design Premium');
  console.log('=================================');
  console.log('✅ Porta:', PORT);
  console.log('🤖 IA: ATIVA para Stories');
  console.log('📱 Stories: Textos otimizados');
  console.log('🎨 Feed: Caixas Premium com gradiente');
  console.log('✨ Badges dinâmicos por área');
  console.log('=================================');
});
