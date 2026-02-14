const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Resend } = require('resend');
const { createCanvas, loadImage, registerFont } = require('canvas');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ================================================
// RESEND - ENVIO DE EMAILS
// ================================================
const resend = new Resend(process.env.RESEND_API_KEY);

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

// Confiar no proxy (nginx) para obter IP real do cliente
app.set('trust proxy', 1);

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
  legacyHeaders: false,
  validate: { xForwardedForHeader: false } // Desabilitar validação (confiamos no nginx)
});

const limiterGeracaoConteudo = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 gerações por minuto
  message: { error: 'Limite de gerações atingido. Aguarde 1 minuto.' },
  validate: { xForwardedForHeader: false }
});

const limiterPagamentos = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 tentativas por minuto
  message: { error: 'Muitas tentativas de pagamento. Aguarde 1 minuto.' },
  validate: { xForwardedForHeader: false }
});

// Aplicar rate limit geral
app.use('/api/', limiterGeral);

// ================================================
// SISTEMA DE FILA PARA GERAÇÃO
// ================================================
const filaGeracao = {
  pendentes: [], // { id, userId, tipo, resolve, reject, timestamp }
  emProcessamento: 0,
  maxConcorrente: 2, // Máximo de gerações simultâneas
  totalProcessado: 0,
  erros: 0
};

function adicionarNaFila(userId, tipo) {
  return new Promise((resolve, reject) => {
    const item = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      userId,
      tipo,
      resolve,
      reject,
      timestamp: Date.now()
    };
    filaGeracao.pendentes.push(item);
    console.log(`📋 Fila: +1 (${filaGeracao.pendentes.length} pendentes, ${filaGeracao.emProcessamento} processando)`);
    processarFila();
  });
}

async function processarFila() {
  // Se já está no limite ou não tem pendentes, retorna
  if (filaGeracao.emProcessamento >= filaGeracao.maxConcorrente || filaGeracao.pendentes.length === 0) {
    return;
  }

  // Pegar próximo da fila
  const item = filaGeracao.pendentes.shift();
  if (!item) return;

  filaGeracao.emProcessamento++;

  // Resolver a promise para liberar a requisição continuar
  item.resolve({
    posicao: 0,
    processando: true,
    tempoEspera: Date.now() - item.timestamp
  });
}

function finalizarProcessamento(sucesso = true) {
  filaGeracao.emProcessamento = Math.max(0, filaGeracao.emProcessamento - 1);
  filaGeracao.totalProcessado++;
  if (!sucesso) filaGeracao.erros++;
  console.log(`✅ Fila: -1 (${filaGeracao.pendentes.length} pendentes, ${filaGeracao.emProcessamento} processando)`);
  // Processar próximo
  setTimeout(processarFila, 100);
}

function posicaoNaFila(userId) {
  const idx = filaGeracao.pendentes.findIndex(p => p.userId === userId);
  return idx === -1 ? 0 : idx + 1;
}

// Endpoint para status da fila
app.get('/api/fila/status', (req, res) => {
  res.json({
    pendentes: filaGeracao.pendentes.length,
    processando: filaGeracao.emProcessamento,
    maxConcorrente: filaGeracao.maxConcorrente,
    totalProcessado: filaGeracao.totalProcessado,
    erros: filaGeracao.erros
  });
});

// Middleware para controlar fila de geração
async function filaMiddleware(req, res, next) {
  const userId = req.user?.id || 'anon';

  // Se a fila está cheia, verificar posição
  if (filaGeracao.emProcessamento >= filaGeracao.maxConcorrente) {
    const posicaoAtual = filaGeracao.pendentes.length + 1;

    // Limite máximo de fila
    if (posicaoAtual > 20) {
      return res.status(503).json({
        error: 'Servidor ocupado',
        message: 'Muitas requisições no momento. Tente novamente em alguns segundos.',
        filaCheia: true
      });
    }

    try {
      // Esperar na fila (timeout de 30 segundos)
      const resultado = await Promise.race([
        adicionarNaFila(userId, req.path),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na fila')), 30000))
      ]);

      console.log(`🚀 Processando após ${resultado.tempoEspera}ms na fila`);
    } catch (error) {
      return res.status(408).json({
        error: 'Timeout',
        message: 'Tempo de espera na fila excedido. Tente novamente.'
      });
    }
  } else {
    filaGeracao.emProcessamento++;
  }

  // Adicionar flag para finalizar no final
  res.on('finish', () => {
    finalizarProcessamento(res.statusCode < 400);
  });

  next();
}

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
  const temaFallback = tema || 'Informação Jurídica';

  // Fallback específico por template
  if (template === 'voce-sabia') {
    return {
      pergunta: `Você sabia sobre ${temaFallback}?`,
      topicos: [
        'Este é um direito garantido por lei',
        'Muitas pessoas desconhecem essa informação',
        'Busque sempre orientação profissional',
        'Fique atento aos prazos legais',
        'Proteja seus direitos'
      ],
      conclusao: 'Conhecimento é poder. Proteja seus direitos!',
      dica: 'Consulte um advogado especialista',
      destaque: 'CONHEÇA SEUS DIREITOS'
    };
  }

  if (template === 'estatistica') {
    return {
      headline: temaFallback,
      estatistica: {
        numero: '70%',
        contexto: 'das pessoas desconhecem seus direitos',
        explicacao: `Quando se trata de ${temaFallback}, muitas pessoas não sabem que possuem proteção legal. É fundamental buscar informação e orientação profissional para garantir que seus direitos sejam respeitados.`
      }
    };
  }

  if (template === 'urgente') {
    return {
      alerta: `ATENÇÃO: Prazo importante sobre ${temaFallback}`,
      prazo: 'Consulte um especialista',
      risco: `Não deixe para depois. Seus direitos podem estar em risco. Busque orientação jurídica o quanto antes. O tempo é crucial em questões legais.`,
      acao: 'CONSULTE UM ADVOGADO ESPECIALISTA'
    };
  }

  // Fallback genérico
  return {
    pergunta: temaFallback,
    resposta: textoLimpo || 'Informação jurídica importante',
    destaque: 'CONHEÇA SEUS DIREITOS',
    headline: temaFallback,
    topicos: ['Busque sempre orientação profissional'],
    estatistica: { numero: '70%', contexto: 'desconhecem seus direitos', explicacao: textoLimpo },
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
// FUNÇÃO: Enviar email de confirmação de pagamento
// ================================================
async function enviarEmailConfirmacaoPagamento(email, dados) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY não configurada - email não enviado');
      return false;
    }

    const { nome, plano, valor, dataFim } = dados;
    const dataFormatada = new Date(dataFim).toLocaleDateString('pt-BR');

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'JurisContent <onboarding@resend.dev>',
      to: email,
      subject: `✅ Pagamento Confirmado - Plano ${plano}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .highlight { background: #e8f4e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
            .btn { display: inline-block; background: #d4af37; color: #1e3a5f; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚖️ JurisContent</h1>
              <p>Pagamento Confirmado!</p>
            </div>
            <div class="content">
              <p>Olá${nome ? `, <strong>${nome}</strong>` : ''}!</p>

              <p>Seu pagamento foi processado com sucesso. Agora você tem acesso completo ao plano <strong>${plano}</strong>.</p>

              <div class="highlight">
                <p><strong>📋 Detalhes da assinatura:</strong></p>
                <ul>
                  <li><strong>Plano:</strong> ${plano}</li>
                  <li><strong>Valor:</strong> R$ ${valor.toFixed(2)}</li>
                  <li><strong>Válido até:</strong> ${dataFormatada}</li>
                </ul>
              </div>

              <p>Você já pode acessar o sistema e começar a criar conteúdos incríveis para suas redes sociais!</p>

              <center>
                <a href="https://blasterskd.com.br" class="btn">Acessar JurisContent</a>
              </center>

              <div class="footer">
                <p>Se tiver dúvidas, entre em contato conosco.</p>
                <p>© ${new Date().getFullYear()} JurisContent - Todos os direitos reservados</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ Erro ao enviar email:', error);
      return false;
    }

    console.log('📧 Email de confirmação enviado para:', email);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    return false;
  }
}

// ================================================
// FUNÇÃO: Notificar admin sobre novo usuário
// ================================================
async function enviarEmailNovoUsuario(dadosUsuario) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY não configurada - email não enviado');
      return false;
    }

    const { email, nome, oab, utm_source, utm_campaign } = dadosUsuario;
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'BlasterSKD <onboarding@resend.dev>',
      to: 'thalesbuenoprado@gmail.com',
      subject: '🎉 Novo usuário no BlasterSKD!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #f59e0b;">🎉 Nova conta criada!</h2>
          <div style="background: #1e293b; padding: 20px; border-radius: 10px; color: #fff;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Nome:</strong> ${nome || 'Não informado'}</p>
            <p><strong>OAB:</strong> ${oab || 'Não informado'}</p>
            <p><strong>Origem:</strong> ${utm_source || 'Direto'}</p>
            <p><strong>Campanha:</strong> ${utm_campaign || 'Nenhuma'}</p>
            <p><strong>Data/Hora:</strong> ${dataHora}</p>
          </div>
          <p style="color: #64748b; margin-top: 20px; font-size: 12px;">
            BlasterSKD - Conteúdo Jurídico com IA
          </p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Erro ao enviar email de novo usuário:', error);
      return false;
    }

    console.log('📧 Email de novo usuário enviado para admin');
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email de novo usuário:', error);
    return false;
  }
}

// ================================================
// FUNÇÃO: Notificar admin sobre nova assinatura
// ================================================
async function enviarEmailNovaAssinatura(dadosAssinatura) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY não configurada - email não enviado');
      return false;
    }

    const { email, nome, plano, valor } = dadosAssinatura;
    const dataHora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const planoFormatado = plano.charAt(0).toUpperCase() + plano.slice(1);

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'BlasterSKD <onboarding@resend.dev>',
      to: 'thalesbuenoprado@gmail.com',
      subject: `💰 Nova assinatura: ${planoFormatado}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #22c55e;">💰 Nova assinatura!</h2>
          <div style="background: #1e293b; padding: 20px; border-radius: 10px; color: #fff;">
            <p><strong>Plano:</strong> <span style="color: #f59e0b; font-size: 18px;">${planoFormatado}</span></p>
            <p><strong>Valor:</strong> R$ ${valor?.toFixed(2) || '0.00'}</p>
            <p><strong>Email:</strong> ${email || 'Não informado'}</p>
            <p><strong>Nome:</strong> ${nome || 'Não informado'}</p>
            <p><strong>Data/Hora:</strong> ${dataHora}</p>
          </div>
          <p style="color: #64748b; margin-top: 20px; font-size: 12px;">
            BlasterSKD - Conteúdo Jurídico com IA
          </p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Erro ao enviar email de nova assinatura:', error);
      return false;
    }

    console.log('📧 Email de nova assinatura enviado para admin');
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar email de nova assinatura:', error);
    return false;
  }
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
// ADMINS COM GERAÇÃO ILIMITADA
// ================================================
const ADMIN_EMAILS = [
  'thalesbuenoprado@gmail.com'
];

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
      .select('geracoes_mes, mes_referencia, plano_atual, email')
      .eq('id', userId)
      .single();

    // Admin tem geração ilimitada
    if (perfil?.email && ADMIN_EMAILS.includes(perfil.email.toLowerCase())) {
      console.log('👑 Admin detectado - geração ilimitada:', perfil.email);
      return {
        permitido: true,
        limite: 0,
        usado: 0,
        restante: -1,
        plano: 'admin',
        isAdmin: true
      };
    }

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
    console.error('Erro ao verificar limite:', error.message);
    // Em caso de erro, bloquear (fail-closed)
    return { permitido: false, limite: 0, usado: 0, restante: 0, plano: 'erro', erro: 'Erro ao verificar limite. Tente novamente.' };
  }
}

// ================================================
// ROTA: GERAR CONTEÚDO STORY (só IA, sem renderizar)
// ================================================
app.post('/api/gerar-conteudo-story', limiterGeracaoConteudo, authMiddleware, filaMiddleware, async (req, res) => {
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
app.post('/api/gerar-story', limiterGeracaoConteudo, authMiddleware, filaMiddleware, async (req, res) => {
  try {
    const {
      texto,
      tema,
      area,
      template,
      perfil_visual,
      tipo_imagem,
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
        tipoImagem: tipo_imagem || 'stock',
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
app.post('/api/gerar-imagem', limiterGeracaoConteudo, authMiddleware, filaMiddleware, async (req, res) => {
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

    // Badges SEM emoji (emojis não renderizam no canvas Node.js)
    const badges = {
      'Direito Penal': 'VOCE SABIA?',
      'Direito Civil': 'DICA JURIDICA',
      'Direito Trabalhista': 'SEUS DIREITOS',
      'Direito do Consumidor': 'FIQUE ATENTO',
      'Direito de Família': 'SAIBA MAIS',
      'Direito Tributário': 'IMPORTANTE',
      'Direito Empresarial': 'EMPRESARIO',
      'Direito Previdenciário': 'APOSENTADORIA',
      'default': 'INFORMACAO JURIDICA'
    };
    const badge = badges[area] || badges['default'];

    // --- BORDA DOURADA SUTIL (2px ao redor da imagem) ---
    ctx.save();
    ctx.strokeStyle = cores.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, dim.w - 4, dim.h - 4);
    ctx.restore();

    // --- GRADIENTE INFERIOR (transparente no topo -> preto 85% embaixo, 60% da imagem) ---
    ctx.save();
    const gradienteY = dim.h * 0.4; // começa a 40% do topo
    const gradiente = ctx.createLinearGradient(0, gradienteY, 0, dim.h);
    gradiente.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradiente.addColorStop(0.3, 'rgba(0, 0, 0, 0.4)');
    gradiente.addColorStop(0.6, 'rgba(0, 0, 0, 0.7)');
    gradiente.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
    ctx.fillStyle = gradiente;
    ctx.fillRect(0, gradienteY, dim.w, dim.h - gradienteY);
    ctx.restore();

    // --- BADGE pill-shaped no topo esquerdo ---
    ctx.save();
    ctx.font = 'bold 22px Arial';
    const badgeMetrics = ctx.measureText(badge);
    const badgePadX = 20;
    const badgePadY = 12;
    const badgeX = paddingH;
    const badgeY = 40;
    const badgeW = badgeMetrics.width + badgePadX * 2;
    const badgeH = 36 + badgePadY;
    const badgeRadius = badgeH / 2;

    // Fundo pill semi-transparente
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeRadius);
    ctx.fill();

    // Borda sutil na pill
    ctx.strokeStyle = cores.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Texto do badge
    ctx.fillStyle = cores.accent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, badgeX + badgePadX, badgeY + badgeH / 2);
    ctx.restore();

    // --- TITULO sobre o gradiente (parte inferior) ---
    if (tema) {
      ctx.font = 'bold 48px Georgia';
      const temaLines = wrapText(ctx, tema, dim.w - paddingH * 2 - 20);
      const lineHeight = 58;
      const temaBlockHeight = temaLines.length * lineHeight;

      // Posicionar titulo: acima do nome do advogado
      const nomeBlockHeight = nomeAdvogado ? 50 : 0;
      const oabBlockHeight = oab ? 35 : 0;
      const bottomMargin = 50;
      const temaStartY = dim.h - bottomMargin - oabBlockHeight - nomeBlockHeight - temaBlockHeight;

      ctx.fillStyle = cores.text;
      ctx.textAlign = 'left';
      temaLines.forEach((line, i) => {
        drawTextWithShadow(ctx, line, paddingH + 10, temaStartY + i * lineHeight);
      });

      // --- NOME DO ADVOGADO + OAB abaixo do titulo ---
      const infoY = temaStartY + temaBlockHeight + 15;

      if (nomeAdvogado) {
        ctx.fillStyle = cores.accent;
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'left';

        let infoText = nomeAdvogado;
        if (oab) {
          infoText += '  |  ' + oab;
        }
        drawTextWithShadow(ctx, infoText, paddingH + 10, infoY);
      } else if (oab) {
        ctx.fillStyle = cores.secondary;
        ctx.font = '24px Arial';
        ctx.textAlign = 'left';
        drawTextWithShadow(ctx, oab, paddingH + 10, infoY);
      }
    } else {
      // Sem tema: só nome e OAB na parte inferior
      const bottomMargin = 60;
      if (nomeAdvogado) {
        ctx.fillStyle = cores.accent;
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'left';
        let infoText = nomeAdvogado;
        if (oab) infoText += '  |  ' + oab;
        drawTextWithShadow(ctx, infoText, paddingH + 10, dim.h - bottomMargin);
      }
    }

    // --- LOGO pequeno no canto superior direito ---
    if (logo) {
      try {
        const logoBase64 = logo.startsWith('data:') ? logo : `data:image/png;base64,${logo}`;
        const logoImage = await loadImage(logoBase64);

        const logoSize = 70;
        const logoX = dim.w - logoSize - 30;
        const logoY = 35;

        // Fundo sutil circular
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Desenhar logo
        ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
      } catch (e) {
        console.log('Erro logo:', e.message);
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
        'X-Api-Key': process.env.REMOVEBG_API_KEY,
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
    const { plano_slug, cupom } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    if (!plano_slug) {
      return res.status(400).json({ error: 'Plano não informado' });
    }

    // Cupons validos
    const cuponsValidos = {
      'BLASTER10': { desconto: 0.10, descricao: '10% off primeiro mes' }
    };
    const cupomAplicado = cupom ? cuponsValidos[cupom.toUpperCase()] : null;

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

    // Se for plano grátis, verificar se tem assinatura ativa antes
    if (plano.preco === 0) {
      const { data: assinaturaAtiva } = await supabase
        .from('assinaturas')
        .select('id, status')
        .eq('user_id', userId)
        .eq('status', 'ativa')
        .single();

      if (assinaturaAtiva) {
        return res.status(400).json({
          error: 'Você possui uma assinatura ativa. Cancele primeiro antes de mudar para o plano grátis.'
        });
      }

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
          unit_price: cupomAplicado
            ? parseFloat((plano.preco * (1 - cupomAplicado.desconto)).toFixed(2))
            : parseFloat(plano.preco)
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
  const webhookSecret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('MERCADOPAGO_WEBHOOK_SECRET nao configurado - webhook REJEITADO');
    return false;
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  if (!xSignature || !xRequestId) {
    console.log('Webhook rejeitado: headers de seguranca ausentes');
    return false;
  }

  try {
    // Extrair ts e v1 do header x-signature
    // Formato: ts=TIMESTAMP,v1=HASH
    const parts = xSignature.split(',');
    let ts = '';
    let v1 = '';

    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 'ts') ts = value;
      if (key === 'v1') v1 = value;
    }

    if (!ts || !v1) {
      console.log('Webhook rejeitado: formato x-signature invalido');
      return false;
    }

    // Construir string de assinatura conforme docs do Mercado Pago
    // Formato: id:[data.id];request-id:[x-request-id];ts:[ts];
    const dataId = req.body.data?.id || '';
    const signedTemplate = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

    // Calcular HMAC
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(signedTemplate);
    const calculatedSignature = hmac.digest('hex');

    // Comparar assinaturas (timing-safe)
    if (v1.length !== calculatedSignature.length) {
      console.log('Webhook rejeitado: assinatura invalida');
      return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(v1),
      Buffer.from(calculatedSignature)
    );

    if (!isValid) {
      console.log('Webhook rejeitado: assinatura invalida');
    }

    return isValid;
  } catch (error) {
    console.error('Erro ao validar webhook:', error.message);
    return false;
  }
}

// Webhook do Mercado Pago
app.post('/api/webhook-mercadopago', async (req, res) => {
  try {
    // Ignorar webhooks IPN (formato antigo) - responder 200 para parar retentativas
    if (req.body.topic || req.body.resource) {
      return res.status(200).send('OK');
    }

    // Ignorar webhooks que não são de pagamento (merchant_order, etc)
    if (req.body.type && req.body.type !== 'payment') {
      return res.status(200).send('OK');
    }

    console.log('Webhook MP recebido:', JSON.stringify(req.body));

    // Validar assinatura do webhook (apenas formato v2)
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

          // Enviar email de confirmação
          // Buscar email do usuário no Supabase
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          const emailDestino = userData?.user?.email || paymentInfo.payer?.email;

          if (emailDestino && emailDestino.includes('@')) {
            await enviarEmailConfirmacaoPagamento(emailDestino, {
              nome: paymentInfo.payer?.first_name || userData?.user?.user_metadata?.nome,
              plano: planoSlug.charAt(0).toUpperCase() + planoSlug.slice(1),
              valor: paymentInfo.transaction_amount,
              dataFim: dataFim.toISOString()
            });
          } else {
            console.log('⚠️ Email não encontrado para enviar confirmação');
          }

          // Notificar admin sobre nova assinatura
          await enviarEmailNovaAssinatura({
            email: emailDestino,
            nome: paymentInfo.payer?.first_name || userData?.user?.user_metadata?.nome,
            plano: planoSlug,
            valor: paymentInfo.transaction_amount
          });

          // Facebook Conversions API - Evento Purchase
          try {
            const pixelId = '1050340382912228';
            const accessToken = process.env.FB_CONVERSIONS_TOKEN;
            if (accessToken) {
              const crypto = require('crypto');
              const hashedEmail = emailDestino ? crypto.createHash('sha256').update(emailDestino.toLowerCase().trim()).digest('hex') : null;
              const eventData = {
                data: [{
                  event_name: 'Purchase',
                  event_time: Math.floor(Date.now() / 1000),
                  action_source: 'website',
                  event_source_url: 'https://blasterskd.com.br/pagamento/sucesso',
                  user_data: {
                    em: hashedEmail ? [hashedEmail] : undefined,
                    client_ip_address: req.headers['x-forwarded-for']?.split(',')[0] || req.ip
                  },
                  custom_data: {
                    value: paymentInfo.transaction_amount,
                    currency: 'BRL',
                    content_name: `Plano ${planoSlug}`,
                    content_type: 'product'
                  }
                }]
              };
              await fetch(`https://graph.facebook.com/v18.0/${pixelId}/events?access_token=${accessToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
              });
              console.log('📊 Facebook Purchase event enviado para:', emailDestino);
            }
          } catch (fbErr) {
            console.log('⚠️ Erro ao enviar evento Facebook:', fbErr.message);
          }
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

// ================================================
// TRACKING DE VISITANTES
// ================================================
const VISITS_FILE = path.join(__dirname, 'visits.json');
const STATS_HISTORY_FILE = path.join(__dirname, 'stats-history.json');

// Carregar visitas existentes
let visitas = [];
try {
  if (fs.existsSync(VISITS_FILE)) {
    visitas = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8'));
  }
} catch (e) {
  visitas = [];
}

// Carregar histórico de stats
let statsHistory = {};
try {
  if (fs.existsSync(STATS_HISTORY_FILE)) {
    statsHistory = JSON.parse(fs.readFileSync(STATS_HISTORY_FILE, 'utf8'));
  }
} catch (e) {
  statsHistory = {};
}

// Salvar visitas no arquivo
function salvarVisitas() {
  try {
    // Manter apenas últimas 1000 visitas
    if (visitas.length > 1000) {
      visitas = visitas.slice(-1000);
    }
    fs.writeFileSync(VISITS_FILE, JSON.stringify(visitas, null, 2));
  } catch (e) {
    console.error('Erro ao salvar visitas:', e);
  }
}

// Atualizar histórico diário
function atualizarHistorico(tipo) {
  const hoje = new Date().toISOString().split('T')[0];
  if (!statsHistory[hoje]) {
    statsHistory[hoje] = { visitas: 0, cadastros: 0 };
  }
  if (tipo === 'visita') {
    statsHistory[hoje].visitas++;
  } else if (tipo === 'cadastro') {
    statsHistory[hoje].cadastros++;
  }
  try {
    fs.writeFileSync(STATS_HISTORY_FILE, JSON.stringify(statsHistory, null, 2));
  } catch (e) {
    console.error('Erro ao salvar histórico:', e);
  }
}

// Endpoint para notificar novo usuário
app.post('/api/notificar-novo-usuario', async (req, res) => {
  try {
    const { email, nome, oab, utm_source, utm_campaign } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email obrigatório' });
    }

    console.log('🆕 Novo usuário registrado:', email);

    // Enviar email para o admin
    await enviarEmailNovoUsuario({ email, nome, oab, utm_source, utm_campaign });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao notificar novo usuário:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ================================================
// ENDPOINT: Postar no Instagram
// ================================================
app.post('/api/postar-instagram', authMiddleware, async (req, res) => {
  try {
    const { imageUrl, caption, type = 'feed' } = req.body; // type: 'feed' ou 'story'

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem é obrigatória' });
    }

    const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
    const PAGE_TOKEN = process.env.INSTAGRAM_PAGE_TOKEN;

    if (!INSTAGRAM_ACCOUNT_ID || !PAGE_TOKEN) {
      return res.status(500).json({ error: 'Instagram não configurado no servidor' });
    }

    const isStory = type === 'story';
    console.log(`📸 Postando ${isStory ? 'STORY' : 'FEED'} no Instagram:`, imageUrl.substring(0, 50) + '...');

    // Passo 1: Criar container de mídia
    const mediaPayload = {
      image_url: imageUrl,
      access_token: PAGE_TOKEN
    };

    // Stories usam media_type: STORIES e não suportam caption
    if (isStory) {
      mediaPayload.media_type = 'STORIES';
    } else {
      mediaPayload.caption = caption || '';
    }

    const createMediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaPayload)
      }
    );

    const mediaData = await createMediaResponse.json();

    if (mediaData.error) {
      console.error('❌ Erro ao criar mídia:', mediaData.error);
      return res.status(400).json({ error: mediaData.error.message });
    }

    const creationId = mediaData.id;
    console.log('✅ Container criado:', creationId);

    // Passo 2: Aguardar processamento da mídia (máx 30 segundos)
    console.log('⏳ Aguardando processamento da mídia...');
    let mediaReady = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000)); // Espera 3 segundos

      const statusResponse = await fetch(
        `https://graph.facebook.com/v18.0/${creationId}?fields=status_code&access_token=${PAGE_TOKEN}`
      );
      const statusData = await statusResponse.json();
      console.log(`📊 Status (tentativa ${i + 1}):`, statusData.status_code);

      if (statusData.status_code === 'FINISHED') {
        mediaReady = true;
        break;
      } else if (statusData.status_code === 'ERROR') {
        return res.status(400).json({ error: 'Erro no processamento da mídia pelo Instagram' });
      }
    }

    if (!mediaReady) {
      return res.status(400).json({ error: 'Timeout: mídia não processada a tempo' });
    }

    console.log('✅ Mídia pronta para publicar');

    // Passo 3: Publicar o container
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: PAGE_TOKEN
        })
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error('❌ Erro ao publicar:', publishData.error);
      return res.status(400).json({ error: publishData.error.message });
    }

    console.log('✅ Post publicado no Instagram:', publishData.id);

    res.json({
      success: true,
      postId: publishData.id,
      message: 'Post publicado com sucesso no Instagram!'
    });

  } catch (error) {
    console.error('❌ Erro ao postar no Instagram:', error);
    res.status(500).json({ error: 'Erro ao postar no Instagram' });
  }
});

// ================================================
// ENDPOINT: Auto-post Instagram (para cron/n8n)
// ================================================
const CRON_SECRET = process.env.CRON_SECRET;

app.post('/api/auto-post-instagram', async (req, res) => {
  try {
    // Verificar chave secreta
    const { secret } = req.body;
    if (secret !== CRON_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    console.log('🤖 Iniciando auto-post no Instagram...');

    // Áreas de atuação para variar os posts
    const areas = ['Direito Civil', 'Direito Trabalhista', 'Direito Penal', 'Direito do Consumidor', 'Direito Previdenciário'];
    const areaAleatoria = areas[Math.floor(Math.random() * areas.length)];

    // Templates para variar
    const templates = ['voce-sabia', 'estatistica', 'urgente'];
    const templateAleatorio = templates[Math.floor(Math.random() * templates.length)];

    // Temas jurídicos variados para posts
    const temasJuridicos = [
      'Direitos do consumidor em compras online',
      'Como funciona a rescisão de contrato de trabalho',
      'Pensão alimentícia: quem tem direito',
      'Direitos do inquilino na locação',
      'Aposentadoria por tempo de contribuição',
      'Horas extras: como calcular corretamente',
      'Divórcio consensual: passo a passo',
      'Acidente de trabalho: seus direitos',
      'Multa por atraso de aluguel',
      'FGTS: quando posso sacar',
      'Direitos na compra de imóvel na planta',
      'Demissão sem justa causa: o que receber',
      'Guarda compartilhada: como funciona',
      'Direitos do MEI',
      'Indenização por danos morais',
      'Herança: como funciona a partilha',
      'Direitos do trabalhador CLT',
      'Contrato de prestação de serviços',
      'Revisão de aluguel: quando pedir',
      'Seguro desemprego: quem tem direito'
    ];
    const tema = temasJuridicos[Math.floor(Math.random() * temasJuridicos.length)];

    console.log('📝 Tema escolhido:', tema);
    console.log('🎨 Template:', templateAleatorio);
    console.log('📚 Área:', areaAleatoria);

    // Gerar story via Puppeteer com estrutura correta
    const storyData = {
      template: templateAleatorio,
      data: {
        tema: tema,
        pergunta: tema + '?',
        area: areaAleatoria,
        instagram: 'blasterskd',
        nomeAdvogado: 'BlasterSKD',
        topicos: [
          'Conheça seus direitos',
          'Informação jurídica de qualidade',
          'Proteja-se com conhecimento',
          'Consulte sempre um advogado',
          'Fique por dentro da lei'
        ],
        conclusao: 'Conhecimento é poder!',
        dica: 'Siga @blasterskd para mais dicas jurídicas'
      }
    };

    const storyResponse = await fetch('http://localhost:3002/render-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storyData)
    });

    const storyResult = await storyResponse.json();

    if (!storyResult.success || !storyResult.image) {
      console.error('❌ Falha ao gerar story:', storyResult);
      return res.status(500).json({ error: 'Falha ao gerar story' });
    }

    // Upload para Cloudinary
    const cloudinary = require('cloudinary').v2;
    const uploadResult = await cloudinary.uploader.upload(storyResult.image, {
      folder: 'instagram-auto-post'
    });

    const imageUrl = uploadResult.secure_url;
    console.log('✅ Story gerado e uploaded:', imageUrl);

    // Preparar caption
    const caption = `${tema}\n\n📚 ${areaAleatoria}\n\n💡 Conhecimento jurídico para você!\n\n#direito #advogado #advocacia #juridico #lei #blasterskd #direitocivil #direitopenal #direitotrabalhista`;

    // Postar no Instagram
    const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
    const PAGE_TOKEN = process.env.INSTAGRAM_PAGE_TOKEN;

    // Criar container
    const createMediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: caption,
          access_token: PAGE_TOKEN
        })
      }
    );

    const mediaData = await createMediaResponse.json();
    if (mediaData.error) {
      console.error('❌ Erro ao criar mídia:', mediaData.error);
      return res.status(400).json({ error: mediaData.error.message });
    }

    // Publicar
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: mediaData.id,
          access_token: PAGE_TOKEN
        })
      }
    );

    const publishData = await publishResponse.json();
    if (publishData.error) {
      console.error('❌ Erro ao publicar:', publishData.error);
      return res.status(400).json({ error: publishData.error.message });
    }

    console.log('✅ Auto-post publicado no Instagram:', publishData.id);

    res.json({
      success: true,
      postId: publishData.id,
      tema: tema,
      template: templateAleatorio,
      area: areaAleatoria,
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('❌ Erro no auto-post:', error);
    res.status(500).json({ error: 'Erro no auto-post' });
  }
});

// ================================================
// ENDPOINT: Postar Instagram via N8N (API Key)
// ================================================
const N8N_API_KEY = process.env.N8N_API_KEY || 'blasterskd-n8n-autopost-2024';

app.post('/api/postar-instagram-auto', async (req, res) => {
  try {
    // Verificar API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== N8N_API_KEY) {
      return res.status(401).json({ error: 'API key inválida' });
    }

    const { imageUrl, caption, type = 'feed', userId, email } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem é obrigatória' });
    }

    // Buscar credenciais do Instagram: por user_id (agendamento) ou env vars (fallback)
    let INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
    let PAGE_TOKEN = process.env.INSTAGRAM_PAGE_TOKEN;

    if (userId) {
      const { data: conn, error: connErr } = await supabase
        .from('instagram_connections')
        .select('instagram_account_id, access_token')
        .eq('user_id', userId)
        .single();

      if (conn && !connErr) {
        INSTAGRAM_ACCOUNT_ID = conn.instagram_account_id;
        PAGE_TOKEN = conn.access_token;
        console.log(`📱 Usando credenciais do usuário ${userId}`);
      }
    }

    // Fallback: se não achou por user_id, busca por outros user_ids do mesmo email
    if ((!INSTAGRAM_ACCOUNT_ID || !PAGE_TOKEN) && email) {
      const { data: otherUsers } = await supabase
        .from('agendamentos')
        .select('user_id')
        .eq('email_usuario', email)
        .limit(20);

      if (otherUsers) {
        const uniqueIds = [...new Set(otherUsers.map(u => u.user_id).filter(id => id !== userId))];
        for (const uid of uniqueIds) {
          const { data: conn2 } = await supabase
            .from('instagram_connections')
            .select('instagram_account_id, access_token')
            .eq('user_id', uid)
            .single();

          if (conn2) {
            INSTAGRAM_ACCOUNT_ID = conn2.instagram_account_id;
            PAGE_TOKEN = conn2.access_token;
            console.log(`📱 Fallback: usando credenciais do user_id ${uid} (mesmo email: ${email})`);
            break;
          }
        }
      }
    }

    if (!INSTAGRAM_ACCOUNT_ID || !PAGE_TOKEN) {
      return res.status(500).json({ error: 'Instagram não configurado' });
    }

    const isStory = type === 'story' || type === 'stories';
    console.log(`📸 N8N Auto-post ${isStory ? 'STORY' : 'FEED'}:`, imageUrl.substring(0, 50) + '...');

    // Criar container de mídia
    const mediaPayload = {
      image_url: imageUrl,
      access_token: PAGE_TOKEN
    };

    if (isStory) {
      mediaPayload.media_type = 'STORIES';
    } else {
      mediaPayload.caption = caption || '';
    }

    const createMediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaPayload)
      }
    );

    const mediaData = await createMediaResponse.json();

    if (mediaData.error) {
      console.error('❌ Erro ao criar mídia:', mediaData.error);
      return res.status(400).json({ error: mediaData.error.message });
    }

    const creationId = mediaData.id;
    console.log('✅ Container criado:', creationId);

    // Aguardar processamento
    console.log('⏳ Aguardando processamento...');
    let mediaReady = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const statusResponse = await fetch(
        `https://graph.facebook.com/v18.0/${creationId}?fields=status_code&access_token=${PAGE_TOKEN}`
      );
      const statusData = await statusResponse.json();
      console.log(`📊 Status (${i + 1}/10):`, statusData.status_code);

      if (statusData.status_code === 'FINISHED') {
        mediaReady = true;
        break;
      } else if (statusData.status_code === 'ERROR') {
        return res.status(400).json({ error: 'Erro no processamento da mídia' });
      }
    }

    if (!mediaReady) {
      return res.status(400).json({ error: 'Timeout: mídia não processada' });
    }

    // Publicar
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: PAGE_TOKEN
        })
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error('❌ Erro ao publicar:', publishData.error);
      return res.status(400).json({ error: publishData.error.message });
    }

    console.log(`✅ ${isStory ? 'Story' : 'Post'} publicado via N8N:`, publishData.id);

    res.json({
      success: true,
      postId: publishData.id,
      type: isStory ? 'story' : 'feed',
      message: `${isStory ? 'Story' : 'Post'} publicado com sucesso!`
    });

  } catch (error) {
    console.error('❌ Erro no auto-post N8N:', error);
    res.status(500).json({ error: 'Erro ao postar no Instagram' });
  }
});

// Endpoint para registrar visita
app.post('/api/track-visit', (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || '';
    const { utm_source, utm_medium, utm_campaign, referrer, pagina } = req.body;

    // Detectar dispositivo
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    const isBot = /bot|crawl|spider|facebook|google/i.test(userAgent);

    // Não registrar bots
    if (isBot) {
      return res.json({ success: true, tracked: false });
    }

    // Extrair navegador
    let browser = 'Outro';
    if (/chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent)) browser = 'Safari';
    else if (/edge/i.test(userAgent)) browser = 'Edge';
    else if (/samsung/i.test(userAgent)) browser = 'Samsung';

    const visita = {
      id: Date.now(),
      ip: ip.substring(0, 12) + '***',
      timestamp: new Date().toISOString(),
      utm_source: utm_source || 'direto',
      utm_medium: utm_medium || '',
      utm_campaign: utm_campaign || '',
      referrer: referrer || '',
      pagina: pagina || '/',
      dispositivo: isMobile ? 'Mobile' : 'Desktop',
      browser
    };

    visitas.push(visita);
    salvarVisitas();
    atualizarHistorico('visita');

    res.json({ success: true, tracked: true });
  } catch (error) {
    console.error('Erro track:', error);
    res.json({ success: false });
  }
});

// ================================================
// ADMIN STATS - Estatísticas secretas
// ================================================
const ADMIN_SECRET = process.env.ADMIN_SECRET;

app.get('/api/admin/stats', async (req, res) => {
  try {
    const secret = req.headers['x-admin-key'] || req.headers['x-admin-secret'] || req.query.secret;
    if (secret !== ADMIN_SECRET) {
      return res.status(401).json({ success: false, error: 'Nao autorizado' });
    }

    // Total de usuários
    const { count: totalUsers } = await supabase
      .from('perfis')
      .select('*', { count: 'exact', head: true });

    // Usuários por origem
    const { data: porOrigem } = await supabase
      .from('perfis')
      .select('utm_source, utm_medium, utm_campaign');

    // Agrupar por origem
    const origens = {};
    (porOrigem || []).forEach(p => {
      const source = p.utm_source || 'direto';
      origens[source] = (origens[source] || 0) + 1;
    });

    // Últimos 10 usuários
    const { data: ultimos } = await supabase
      .from('perfis')
      .select('nome, email, utm_source, utm_campaign, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Usuários de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const { count: hojeCont } = await supabase
      .from('perfis')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoje.toISOString());

    // Estatísticas de visitas
    const hojeStr = hoje.toISOString().split('T')[0];
    const visitasHoje = visitas.filter(v => v.timestamp?.startsWith(hojeStr));

    // Agrupar visitas por origem
    const visitasPorOrigem = {};
    visitas.forEach(v => {
      const src = v.utm_source || 'direto';
      visitasPorOrigem[src] = (visitasPorOrigem[src] || 0) + 1;
    });

    // Agrupar visitas por dispositivo
    const visitasPorDispositivo = {};
    visitas.forEach(v => {
      const disp = v.dispositivo || 'Desconhecido';
      visitasPorDispositivo[disp] = (visitasPorDispositivo[disp] || 0) + 1;
    });

    // Últimas 20 visitas
    const ultimasVisitas = visitas.slice(-20).reverse();

    // Histórico dos últimos 7 dias
    const historico = [];
    for (let i = 6; i >= 0; i--) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];
      const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'][data.getDay()];
      historico.push({
        data: dataStr,
        dia: diaSemana,
        visitas: statsHistory[dataStr]?.visitas || 0,
        cadastros: statsHistory[dataStr]?.cadastros || 0
      });
    }

    // Calcular médias para previsão
    const totalVisitasSemana = historico.reduce((acc, h) => acc + h.visitas, 0);
    const totalCadastrosSemana = historico.reduce((acc, h) => acc + h.cadastros, 0);
    const mediaVisitasDia = totalVisitasSemana / 7;
    const mediaCadastrosDia = totalCadastrosSemana / 7;
    const taxaConversao = totalVisitasSemana > 0 ? (totalCadastrosSemana / totalVisitasSemana * 100) : 0;

    // Previsão próximos 7 dias
    const previsao = {
      visitasSemana: Math.round(mediaVisitasDia * 7),
      cadastrosSemana: Math.round(mediaCadastrosDia * 7),
      visitasMes: Math.round(mediaVisitasDia * 30),
      cadastrosMes: Math.round(mediaCadastrosDia * 30),
      taxaConversao: taxaConversao.toFixed(1)
    };

    res.json({
      success: true,
      stats: {
        usuarios: {
          total: totalUsers || 0,
          hoje: hojeCont || 0,
          porOrigem: origens,
          ultimos: (ultimos || []).map(u => ({
            nome: u.nome,
            email: u.email?.substring(0, 3) + '***',
            origem: u.utm_source || 'direto',
            campanha: u.utm_campaign || '-',
            data: u.created_at
          }))
        },
        visitas: {
          total: visitas.length,
          hoje: visitasHoje.length,
          porOrigem: visitasPorOrigem,
          porDispositivo: visitasPorDispositivo,
          ultimas: ultimasVisitas
        },
        historico,
        previsao,
        servidor: {
          fila: {
            pendentes: filaGeracao.pendentes.length,
            processando: filaGeracao.emProcessamento,
            maxConcorrente: filaGeracao.maxConcorrente,
            totalProcessado: filaGeracao.totalProcessado,
            erros: filaGeracao.erros
          }
        }
      }
    });
  } catch (error) {
    console.error('Erro stats:', error);
    res.status(500).json({ error: 'Erro ao buscar stats' });
  }
});

// ================================================
// INSTAGRAM OAUTH - Conexão por usuário
// ================================================
const FB_APP_ID = process.env.FB_APP_ID;
const FB_APP_SECRET = process.env.FB_APP_SECRET;
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://blasterskd.com.br/api/instagram/callback';

// Iniciar conexão OAuth
app.get('/api/instagram/connect', authMiddleware, (req, res) => {
  const state = Buffer.from(JSON.stringify({
    userId: req.user.id,
    timestamp: Date.now()
  })).toString('base64');

  const scopes = [
    'instagram_basic',
    'instagram_content_publish',
    'instagram_manage_comments',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
    'business_management'
  ].join(',');

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${FB_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}` +
    `&scope=${scopes}` +
    `&state=${state}` +
    `&response_type=code`;

  res.json({ authUrl });
});

// Callback do OAuth
app.get('/api/instagram/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      console.error('❌ OAuth error:', error, error_description);
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=' + encodeURIComponent(error_description || error));
    }

    if (!code || !state) {
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=Parametros+invalidos');
    }

    // Decodificar state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (e) {
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=State+invalido');
    }

    const userId = stateData.userId;
    console.log('📸 OAuth callback para user:', userId);

    // Trocar code por access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${FB_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}` +
      `&client_secret=${FB_APP_SECRET}` +
      `&code=${code}`
    );

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('❌ Token error:', tokenData.error);
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=' + encodeURIComponent(tokenData.error.message));
    }

    const shortLivedToken = tokenData.access_token;

    // Trocar por long-lived token (60 dias)
    const longTokenResponse = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${FB_APP_ID}` +
      `&client_secret=${FB_APP_SECRET}` +
      `&fb_exchange_token=${shortLivedToken}`
    );

    const longTokenData = await longTokenResponse.json();

    if (longTokenData.error) {
      console.error('❌ Long token error:', longTokenData.error);
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=' + encodeURIComponent(longTokenData.error.message));
    }

    const accessToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in || 5184000; // 60 dias padrão

    // Buscar páginas do usuário
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
    );
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=Nenhuma+pagina+encontrada.+Voce+precisa+ter+uma+Pagina+do+Facebook+vinculada+ao+Instagram.');
    }

    // Coletar TODAS as páginas com Instagram Business
    const pagesWithInstagram = [];

    for (const page of pagesData.data) {
      const igResponse = await fetch(
        `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account,name&access_token=${page.access_token}`
      );
      const igData = await igResponse.json();

      if (igData.instagram_business_account) {
        // Buscar username do Instagram
        const usernameResponse = await fetch(
          `https://graph.facebook.com/v18.0/${igData.instagram_business_account.id}?fields=username,profile_picture_url&access_token=${page.access_token}`
        );
        const usernameData = await usernameResponse.json();

        pagesWithInstagram.push({
          pageId: page.id,
          pageName: igData.name,
          pageToken: page.access_token,
          instagramAccountId: igData.instagram_business_account.id,
          instagramUsername: usernameData.username,
          profilePicture: usernameData.profile_picture_url || null
        });
      }
    }

    if (pagesWithInstagram.length === 0) {
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=Nenhuma+conta+Instagram+Business+encontrada.+Vincule+seu+Instagram+a+uma+Pagina+do+Facebook.');
    }

    console.log(`✅ Encontradas ${pagesWithInstagram.length} conta(s) Instagram`);

    // Se tiver apenas 1 conta, conectar automaticamente
    if (pagesWithInstagram.length === 1) {
      const account = pagesWithInstagram[0];
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const { error: dbError } = await supabase
        .from('instagram_connections')
        .upsert({
          user_id: userId,
          instagram_account_id: account.instagramAccountId,
          instagram_username: account.instagramUsername,
          page_name: account.pageName,
          access_token: account.pageToken,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (dbError) {
        console.error('❌ DB error:', dbError);
        return res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=Erro+ao+salvar+conexao');
      }

      console.log('✅ Conexão salva para user:', userId);
      return res.redirect('https://blasterskd.com.br/configuracoes?instagram=success&username=' + encodeURIComponent(account.instagramUsername));
    }

    // Se tiver múltiplas contas, salvar temporariamente e redirecionar para seleção
    const selectionToken = Buffer.from(JSON.stringify({
      userId,
      expiresIn,
      accounts: pagesWithInstagram,
      createdAt: Date.now()
    })).toString('base64');

    // Salvar token temporário no banco (expira em 10 minutos)
    await supabase.from('instagram_pending_selections').upsert({
      user_id: userId,
      selection_data: selectionToken,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    }, { onConflict: 'user_id' });

    console.log('✅ Múltiplas contas - redirecionando para seleção');
    res.redirect('https://blasterskd.com.br/configuracoes?instagram=select');

  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.redirect('https://blasterskd.com.br/configuracoes?instagram=error&msg=Erro+interno');
  }
});

// Status da conexão
app.get('/api/instagram/status', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('instagram_connections')
      .select('instagram_username, page_name, token_expires_at, updated_at')
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.json({ connected: false });
    }

    const expiresAt = new Date(data.token_expires_at);
    const isExpired = expiresAt < new Date();

    res.json({
      connected: !isExpired,
      username: data.instagram_username,
      pageName: data.page_name,
      expiresAt: data.token_expires_at,
      isExpired
    });
  } catch (error) {
    console.error('❌ Status error:', error);
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
});

// Buscar opções de contas para seleção
app.get('/api/instagram/pending-selection', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('instagram_pending_selections')
      .select('selection_data, expires_at')
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.json({ hasPending: false });
    }

    // Verificar se expirou
    if (new Date(data.expires_at) < new Date()) {
      await supabase.from('instagram_pending_selections').delete().eq('user_id', req.user.id);
      return res.json({ hasPending: false, expired: true });
    }

    // Decodificar dados
    const selectionData = JSON.parse(Buffer.from(data.selection_data, 'base64').toString());

    res.json({
      hasPending: true,
      accounts: selectionData.accounts.map(a => ({
        instagramAccountId: a.instagramAccountId,
        instagramUsername: a.instagramUsername,
        pageName: a.pageName,
        profilePicture: a.profilePicture
      }))
    });
  } catch (error) {
    console.error('❌ Pending selection error:', error);
    res.status(500).json({ error: 'Erro ao buscar opções' });
  }
});

// Finalizar seleção de conta Instagram
app.post('/api/instagram/select', authMiddleware, async (req, res) => {
  try {
    const { instagramAccountId } = req.body;

    if (!instagramAccountId) {
      return res.status(400).json({ error: 'ID da conta é obrigatório' });
    }

    // Buscar dados pendentes
    const { data, error } = await supabase
      .from('instagram_pending_selections')
      .select('selection_data')
      .eq('user_id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(400).json({ error: 'Nenhuma seleção pendente encontrada. Conecte novamente.' });
    }

    const selectionData = JSON.parse(Buffer.from(data.selection_data, 'base64').toString());

    // Encontrar a conta selecionada
    const selectedAccount = selectionData.accounts.find(a => a.instagramAccountId === instagramAccountId);

    if (!selectedAccount) {
      return res.status(400).json({ error: 'Conta não encontrada nas opções' });
    }

    // Salvar conexão
    const expiresAt = new Date(Date.now() + selectionData.expiresIn * 1000).toISOString();

    const { error: dbError } = await supabase
      .from('instagram_connections')
      .upsert({
        user_id: req.user.id,
        instagram_account_id: selectedAccount.instagramAccountId,
        instagram_username: selectedAccount.instagramUsername,
        page_name: selectedAccount.pageName,
        access_token: selectedAccount.pageToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (dbError) {
      console.error('❌ DB error:', dbError);
      return res.status(500).json({ error: 'Erro ao salvar conexão' });
    }

    // Limpar seleção pendente
    await supabase.from('instagram_pending_selections').delete().eq('user_id', req.user.id);

    console.log('✅ Conta selecionada:', selectedAccount.instagramUsername);
    res.json({
      success: true,
      username: selectedAccount.instagramUsername,
      pageName: selectedAccount.pageName
    });
  } catch (error) {
    console.error('❌ Select error:', error);
    res.status(500).json({ error: 'Erro ao selecionar conta' });
  }
});

// Desconectar Instagram
app.delete('/api/instagram/disconnect', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase
      .from('instagram_connections')
      .delete()
      .eq('user_id', req.user.id);

    if (error) throw error;

    res.json({ success: true, message: 'Instagram desconectado' });
  } catch (error) {
    console.error('❌ Disconnect error:', error);
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

// Postar no Instagram do usuário (usa token dele)
app.post('/api/instagram/post', authMiddleware, async (req, res) => {
  try {
    const { imageUrl, caption, type = 'feed' } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem é obrigatória' });
    }

    // Buscar conexão do usuário
    const { data: connection, error: connError } = await supabase
      .from('instagram_connections')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (connError || !connection) {
      return res.status(400).json({
        error: 'Instagram não conectado',
        needsConnection: true
      });
    }

    // Verificar se token expirou
    if (new Date(connection.token_expires_at) < new Date()) {
      return res.status(400).json({
        error: 'Token expirado. Reconecte seu Instagram.',
        needsReconnection: true
      });
    }

    const isStory = type === 'story' || type === 'stories';
    console.log(`📸 Postando ${isStory ? 'STORY' : 'FEED'} para @${connection.instagram_username}`);

    // Criar container de mídia
    const mediaPayload = {
      image_url: imageUrl,
      access_token: connection.access_token
    };

    if (isStory) {
      mediaPayload.media_type = 'STORIES';
    } else {
      mediaPayload.caption = caption || '';
    }

    const createMediaResponse = await fetch(
      `https://graph.facebook.com/v18.0/${connection.instagram_account_id}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaPayload)
      }
    );

    const mediaData = await createMediaResponse.json();

    if (mediaData.error) {
      console.error('❌ Erro ao criar mídia:', mediaData.error);
      return res.status(400).json({ error: mediaData.error.message });
    }

    const creationId = mediaData.id;
    console.log('✅ Container criado:', creationId);

    // Aguardar processamento
    let mediaReady = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));

      const statusResponse = await fetch(
        `https://graph.facebook.com/v18.0/${creationId}?fields=status_code&access_token=${connection.access_token}`
      );
      const statusData = await statusResponse.json();

      if (statusData.status_code === 'FINISHED') {
        mediaReady = true;
        break;
      } else if (statusData.status_code === 'ERROR') {
        return res.status(400).json({ error: 'Erro no processamento da mídia' });
      }
    }

    if (!mediaReady) {
      return res.status(400).json({ error: 'Timeout: mídia não processada' });
    }

    // Publicar
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${connection.instagram_account_id}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: connection.access_token
        })
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error('❌ Erro ao publicar:', publishData.error);
      return res.status(400).json({ error: publishData.error.message });
    }

    console.log(`✅ ${isStory ? 'Story' : 'Post'} publicado: @${connection.instagram_username}`);

    res.json({
      success: true,
      postId: publishData.id,
      type: isStory ? 'story' : 'feed',
      username: connection.instagram_username
    });

  } catch (error) {
    console.error('❌ Post error:', error);
    res.status(500).json({ error: 'Erro ao postar no Instagram' });
  }
});

// ================================================
// AUTOMAÇÃO DE EMAIL MARKETING
// ================================================

// Templates de email
const emailTemplates = {
  boasVindas: (nome) => ({
    subject: '🎉 Bem-vindo ao BlasterSKD!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 40px 30px; text-align: center; }
          .header h1 { margin: 0; color: #f59e0b; font-size: 28px; }
          .content { background: #f8fafc; padding: 40px 30px; }
          .highlight { background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b; }
          .btn { display: inline-block; background: #f59e0b; color: #1e293b; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
          .steps { margin: 20px 0; }
          .step { display: flex; margin: 15px 0; align-items: flex-start; }
          .step-num { background: #f59e0b; color: #1e293b; width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 15px; flex-shrink: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚖️ BlasterSKD</h1>
            <p style="margin: 10px 0 0; opacity: 0.9;">Marketing Jurídico com IA</p>
          </div>
          <div class="content">
            <h2>Olá${nome ? `, ${nome}` : ''}! 👋</h2>

            <p>Seja muito bem-vindo ao <strong>BlasterSKD</strong>! Estamos felizes em ter você conosco.</p>

            <div class="highlight">
              <strong>🚀 Comece agora em 3 passos:</strong>
              <div class="steps">
                <div class="step"><span class="step-num">1</span> Escolha a área do direito</div>
                <div class="step"><span class="step-num">2</span> Selecione um tema</div>
                <div class="step"><span class="step-num">3</span> Clique em gerar - a IA faz o resto!</div>
              </div>
            </div>

            <p>Com o BlasterSKD você cria posts profissionais para Instagram em segundos. Chega de perder horas criando conteúdo!</p>

            <center>
              <a href="https://blasterskd.com.br" class="btn">Criar meu primeiro post</a>
            </center>
          </div>
          <div class="footer">
            <p>Dúvidas? Responda este email que ajudamos você.</p>
            <p>© ${new Date().getFullYear()} BlasterSKD - Marketing Jurídico com IA</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  onboardingDia2: (nome) => ({
    subject: '💡 Dica: Conecte seu Instagram',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #f59e0b; }
          .content { background: #f8fafc; padding: 30px; }
          .tip-box { background: #dbeafe; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #3b82f6; }
          .btn { display: inline-block; background: #f59e0b; color: #1e293b; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚖️ BlasterSKD</h1>
          </div>
          <div class="content">
            <h2>${nome ? `${nome}, você` : 'Você'} sabia? 🤔</h2>

            <p>Você pode <strong>postar direto no Instagram</strong> sem sair do BlasterSKD!</p>

            <div class="tip-box">
              <strong>📱 Como conectar:</strong>
              <ol>
                <li>Acesse as Configurações no BlasterSKD</li>
                <li>Clique em "Conectar Instagram"</li>
                <li>Autorize com sua conta do Facebook</li>
                <li>Pronto! Agora é só clicar em "Postar" após gerar o conteúdo</li>
              </ol>
            </div>

            <p>Assim você economiza ainda mais tempo - gera o conteúdo e publica com um clique!</p>

            <center>
              <a href="https://blasterskd.com.br" class="btn">Conectar meu Instagram</a>
            </center>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlasterSKD</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  onboardingDia5: (nome) => ({
    subject: '📅 Já conhece o agendamento?',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #f59e0b; }
          .content { background: #f8fafc; padding: 30px; }
          .feature-box { background: #dcfce7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #22c55e; }
          .btn { display: inline-block; background: #f59e0b; color: #1e293b; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚖️ BlasterSKD</h1>
          </div>
          <div class="content">
            <h2>Programe sua semana inteira! 📅</h2>

            <p>${nome ? `${nome}, com` : 'Com'} o <strong>agendamento do BlasterSKD</strong> você pode criar todos os posts da semana de uma vez e deixar tudo programado.</p>

            <div class="feature-box">
              <strong>✨ Benefícios do agendamento:</strong>
              <ul>
                <li>Crie conteúdo quando tiver tempo</li>
                <li>Posts publicados automaticamente</li>
                <li>Mantenha consistência nas redes</li>
                <li>Visualize seu calendário de posts</li>
              </ul>
            </div>

            <p>Dedique 1 hora por semana e deixe o BlasterSKD cuidar do resto!</p>

            <center>
              <a href="https://blasterskd.com.br" class="btn">Agendar meus posts</a>
            </center>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlasterSKD</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  onboardingDia7: (nome, planoAtual) => ({
    subject: planoAtual === 'gratuito' ? '🚀 Desbloqueie todo o potencial!' : '🎯 Como está sua experiência?',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #f59e0b; }
          .content { background: #f8fafc; padding: 30px; }
          .upgrade-box { background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 10px; margin: 20px 0; text-align: center; }
          .btn { display: inline-block; background: #f59e0b; color: #1e293b; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .btn-secondary { display: inline-block; background: #1e293b; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-left: 10px; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚖️ BlasterSKD</h1>
          </div>
          <div class="content">
            <h2>${nome ? `${nome}, já` : 'Já'} faz 1 semana! 🎉</h2>

            <p>Como está sendo sua experiência com o BlasterSKD?</p>

            ${planoAtual === 'gratuito' ? `
            <div class="upgrade-box">
              <h3 style="margin-top: 0; color: #1e293b;">🚀 Quer criar mais conteúdo?</h3>
              <p>No plano <strong>Essencial</strong> você tem:</p>
              <ul style="text-align: left; display: inline-block;">
                <li>30 posts por mês (vs 5 do gratuito)</li>
                <li>Stories ilimitados</li>
                <li>Agendamento de posts</li>
                <li>Suporte prioritário</li>
              </ul>
              <p><strong>Por apenas R$ 47/mês</strong></p>
            </div>
            ` : `
            <p>Esperamos que esteja aproveitando todos os recursos do seu plano!</p>
            `}

            <center>
              ${planoAtual === 'gratuito' ?
                '<a href="https://blasterskd.com.br/#precos" class="btn">Ver planos</a>' :
                '<a href="https://blasterskd.com.br" class="btn">Acessar BlasterSKD</a>'
              }
            </center>

            <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Tem alguma dúvida ou sugestão? Responda este email - adoramos ouvir nossos usuários!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlasterSKD</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  usuarioInativo: (nome) => ({
    subject: '😢 Sentimos sua falta!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; color: #f59e0b; }
          .content { background: #f8fafc; padding: 30px; }
          .comeback-box { background: #fef3c7; padding: 25px; border-radius: 10px; margin: 20px 0; text-align: center; }
          .btn { display: inline-block; background: #f59e0b; color: #1e293b; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; }
          .footer { text-align: center; padding: 20px; color: #64748b; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚖️ BlasterSKD</h1>
          </div>
          <div class="content">
            <h2>${nome ? `${nome}, tudo` : 'Tudo'} bem? 👋</h2>

            <p>Notamos que você não acessa o BlasterSKD há alguns dias. Está tudo bem?</p>

            <div class="comeback-box">
              <h3 style="margin-top: 0;">🆕 Enquanto você estava fora:</h3>
              <ul style="text-align: left; display: inline-block;">
                <li>Novos temas de conteúdo disponíveis</li>
                <li>Melhorias na geração com IA</li>
                <li>Novos templates de stories</li>
              </ul>
            </div>

            <p>Seus seguidores sentem falta do seu conteúdo! Que tal criar um post agora?</p>

            <center>
              <a href="https://blasterskd.com.br" class="btn">Voltar ao BlasterSKD</a>
            </center>

            <p style="margin-top: 30px; font-size: 14px; color: #64748b;">Se precisar de ajuda ou tiver algum problema, estamos aqui para ajudar!</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BlasterSKD</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Função para enviar email de marketing
async function enviarEmailMarketing(to, template) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.log('⚠️ RESEND_API_KEY não configurada');
      return { success: false, error: 'API key não configurada' };
    }

    const { data, error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'BlasterSKD <contato@blasterskd.com.br>',
      to: to,
      subject: template.subject,
      html: template.html
    });

    if (error) {
      console.error('❌ Erro ao enviar email:', error);
      return { success: false, error: error.message };
    }

    console.log('📧 Email marketing enviado para:', to);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('❌ Erro ao enviar email:', error);
    return { success: false, error: error.message };
  }
}

// Endpoint para executar automações de email (chamado pelo n8n)
app.post('/api/automacao/emails', async (req, res) => {
  try {
    const authKey = req.headers['x-automation-key'];
    if (authKey !== process.env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const hoje = new Date();
    const resultados = {
      boasVindas: [],
      onboardingDia2: [],
      onboardingDia5: [],
      onboardingDia7: [],
      inativos: [],
      erros: []
    };

    // Função auxiliar para calcular data X dias atrás
    const diasAtras = (dias) => {
      const data = new Date(hoje);
      data.setDate(data.getDate() - dias);
      return data.toISOString().split('T')[0];
    };

    // Buscar configurações de email
    const { data: configData } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'email_marketing')
      .single();
    const emailConfig = configData?.valor || {};

    // 1. BOAS-VINDAS - Usuários criados hoje
    if (emailConfig.boasVindas?.ativo !== false) {
      const { data: novosUsuarios } = await supabase
        .from('perfis')
        .select('user_id, nome, email, created_at')
        .gte('created_at', diasAtras(0) + 'T00:00:00')
        .lt('created_at', diasAtras(0) + 'T23:59:59')
        .is('email_boas_vindas_enviado', null);

      for (const usuario of novosUsuarios || []) {
        if (usuario.email) {
          const template = emailTemplates.boasVindas(usuario.nome);
          const resultado = await enviarEmailMarketing(usuario.email, template);
          if (resultado.success) {
            resultados.boasVindas.push(usuario.email);
            await supabase.from('perfis').update({ email_boas_vindas_enviado: new Date().toISOString() }).eq('user_id', usuario.user_id);
          } else {
            resultados.erros.push({ email: usuario.email, tipo: 'boasVindas', erro: resultado.error });
          }
        }
      }
    }

    // 2. ONBOARDING DIA 2
    if (emailConfig.onboardingDia2?.ativo !== false) {
      const { data: usuariosDia2 } = await supabase
        .from('perfis')
        .select('user_id, nome, email, created_at')
        .gte('created_at', diasAtras(2) + 'T00:00:00')
        .lt('created_at', diasAtras(2) + 'T23:59:59')
        .not('email_boas_vindas_enviado', 'is', null)
        .is('email_onboarding_dia2_enviado', null);

      for (const usuario of usuariosDia2 || []) {
        if (usuario.email) {
          const template = emailTemplates.onboardingDia2(usuario.nome);
          const resultado = await enviarEmailMarketing(usuario.email, template);
          if (resultado.success) {
            resultados.onboardingDia2.push(usuario.email);
            await supabase.from('perfis').update({ email_onboarding_dia2_enviado: new Date().toISOString() }).eq('user_id', usuario.user_id);
          } else {
            resultados.erros.push({ email: usuario.email, tipo: 'onboardingDia2', erro: resultado.error });
          }
        }
      }
    }

    // 3. ONBOARDING DIA 5
    if (emailConfig.onboardingDia5?.ativo !== false) {
      const { data: usuariosDia5 } = await supabase
        .from('perfis')
        .select('user_id, nome, email, created_at')
        .gte('created_at', diasAtras(5) + 'T00:00:00')
        .lt('created_at', diasAtras(5) + 'T23:59:59')
        .not('email_onboarding_dia2_enviado', 'is', null)
        .is('email_onboarding_dia5_enviado', null);

      for (const usuario of usuariosDia5 || []) {
        if (usuario.email) {
          const template = emailTemplates.onboardingDia5(usuario.nome);
          const resultado = await enviarEmailMarketing(usuario.email, template);
          if (resultado.success) {
            resultados.onboardingDia5.push(usuario.email);
            await supabase.from('perfis').update({ email_onboarding_dia5_enviado: new Date().toISOString() }).eq('user_id', usuario.user_id);
          } else {
            resultados.erros.push({ email: usuario.email, tipo: 'onboardingDia5', erro: resultado.error });
          }
        }
      }
    }

    // 4. ONBOARDING DIA 7 (com info do plano)
    if (emailConfig.onboardingDia7?.ativo !== false) {
      const { data: usuariosDia7 } = await supabase
        .from('perfis')
        .select('user_id, nome, email, created_at, plano')
        .gte('created_at', diasAtras(7) + 'T00:00:00')
        .lt('created_at', diasAtras(7) + 'T23:59:59')
        .not('email_onboarding_dia5_enviado', 'is', null)
        .is('email_onboarding_dia7_enviado', null);

      for (const usuario of usuariosDia7 || []) {
        if (usuario.email) {
          const template = emailTemplates.onboardingDia7(usuario.nome, usuario.plano || 'gratuito');
          const resultado = await enviarEmailMarketing(usuario.email, template);
          if (resultado.success) {
            resultados.onboardingDia7.push(usuario.email);
            await supabase.from('perfis').update({ email_onboarding_dia7_enviado: new Date().toISOString() }).eq('user_id', usuario.user_id);
          } else {
            resultados.erros.push({ email: usuario.email, tipo: 'onboardingDia7', erro: resultado.error });
          }
        }
      }
    }

    // 5. USUÁRIOS INATIVOS (último acesso > 7 dias, não recebeu email de inativo nos últimos 30 dias)
    if (emailConfig.inativo?.ativo !== false) {
      const { data: usuariosInativos } = await supabase
        .from('perfis')
        .select('user_id, nome, email, ultimo_acesso, email_inativo_enviado')
        .lt('ultimo_acesso', diasAtras(7))
        .or(`email_inativo_enviado.is.null,email_inativo_enviado.lt.${diasAtras(30)}`);

      for (const usuario of usuariosInativos || []) {
        if (usuario.email) {
          const template = emailTemplates.usuarioInativo(usuario.nome);
          const resultado = await enviarEmailMarketing(usuario.email, template);
          if (resultado.success) {
            resultados.inativos.push(usuario.email);
            await supabase.from('perfis').update({ email_inativo_enviado: new Date().toISOString() }).eq('user_id', usuario.user_id);
          } else {
            resultados.erros.push({ email: usuario.email, tipo: 'inativo', erro: resultado.error });
          }
        }
      }
    }

    console.log('📧 Automação de emails executada:', {
      boasVindas: resultados.boasVindas.length,
      onboardingDia2: resultados.onboardingDia2.length,
      onboardingDia5: resultados.onboardingDia5.length,
      onboardingDia7: resultados.onboardingDia7.length,
      inativos: resultados.inativos.length,
      erros: resultados.erros.length
    });

    res.json({
      success: true,
      resumo: {
        boasVindas: resultados.boasVindas.length,
        onboardingDia2: resultados.onboardingDia2.length,
        onboardingDia5: resultados.onboardingDia5.length,
        onboardingDia7: resultados.onboardingDia7.length,
        inativos: resultados.inativos.length,
        erros: resultados.erros.length
      },
      detalhes: resultados
    });

  } catch (error) {
    console.error('❌ Erro na automação de emails:', error);
    res.status(500).json({ error: 'Erro ao executar automação', details: error.message });
  }
});

// Endpoint para testar envio de email específico
app.post('/api/automacao/teste-email', async (req, res) => {
  try {
    const authKey = req.headers['x-automation-key'];
    if (authKey !== process.env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { tipo, email, nome } = req.body;

    if (!tipo || !email) {
      return res.status(400).json({ error: 'tipo e email são obrigatórios' });
    }

    const templates = {
      boasVindas: emailTemplates.boasVindas(nome),
      onboardingDia2: emailTemplates.onboardingDia2(nome),
      onboardingDia5: emailTemplates.onboardingDia5(nome),
      onboardingDia7: emailTemplates.onboardingDia7(nome, 'gratuito'),
      inativo: emailTemplates.usuarioInativo(nome)
    };

    const template = templates[tipo];
    if (!template) {
      return res.status(400).json({ error: 'Tipo de email inválido', tiposDisponiveis: Object.keys(templates) });
    }

    const resultado = await enviarEmailMarketing(email, template);
    res.json(resultado);

  } catch (error) {
    console.error('❌ Erro no teste de email:', error);
    res.status(500).json({ error: 'Erro ao enviar email de teste', details: error.message });
  }
});

// ================================================
// CONFIGURAÇÕES DE EMAIL (para painel admin)
// ================================================

// Configurações padrão de email
const emailConfigPadrao = {
  boasVindas: { ativo: true, nome: 'Boas-vindas', descricao: 'Enviado quando usuário se cadastra' },
  onboardingDia2: { ativo: true, nome: 'Onboarding Dia 2', descricao: 'Dica para conectar Instagram' },
  onboardingDia5: { ativo: true, nome: 'Onboarding Dia 5', descricao: 'Dica sobre agendamento' },
  onboardingDia7: { ativo: true, nome: 'Onboarding Dia 7', descricao: 'Oferta de upgrade' },
  inativo: { ativo: true, nome: 'Usuário Inativo', descricao: 'Enviado após 7 dias sem acesso' }
};

// GET - Obter configurações de email
app.get('/api/admin/email-config', async (req, res) => {
  try {
    const authKey = req.headers['x-admin-key'];
    if (authKey !== process.env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Buscar config do Supabase
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('chave', 'email_marketing')
      .single();

    if (error || !data) {
      // Retorna config padrão se não existir
      return res.json({ success: true, config: emailConfigPadrao });
    }

    res.json({ success: true, config: data.valor });
  } catch (error) {
    console.error('❌ Erro ao buscar config:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações' });
  }
});

// POST - Atualizar configurações de email
app.post('/api/admin/email-config', async (req, res) => {
  try {
    const authKey = req.headers['x-admin-key'];
    if (authKey !== process.env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ error: 'config é obrigatório' });
    }

    // Salvar no Supabase
    const { error } = await supabase
      .from('configuracoes')
      .upsert({
        chave: 'email_marketing',
        valor: config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });

    if (error) {
      console.error('❌ Erro ao salvar config:', error);
      return res.status(500).json({ error: 'Erro ao salvar configurações' });
    }

    console.log('✅ Configurações de email atualizadas');
    res.json({ success: true, config });
  } catch (error) {
    console.error('❌ Erro ao salvar config:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
});

// GET - Histórico de emails enviados
app.get('/api/admin/email-historico', async (req, res) => {
  try {
    const authKey = req.headers['x-admin-key'];
    if (authKey !== process.env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Buscar últimos envios do Supabase
    const { data, error } = await supabase
      .from('perfis')
      .select('email, nome, email_boas_vindas_enviado, email_onboarding_dia2_enviado, email_onboarding_dia5_enviado, email_onboarding_dia7_enviado, email_inativo_enviado')
      .or('email_boas_vindas_enviado.not.is.null,email_onboarding_dia2_enviado.not.is.null,email_inativo_enviado.not.is.null')
      .order('email_boas_vindas_enviado', { ascending: false, nullsFirst: false })
      .limit(50);

    if (error) {
      console.error('❌ Erro ao buscar histórico:', error);
      return res.status(500).json({ error: 'Erro ao buscar histórico' });
    }

    // Formatar dados
    const historico = [];
    for (const perfil of data || []) {
      if (perfil.email_boas_vindas_enviado) {
        historico.push({ email: perfil.email, nome: perfil.nome, tipo: 'Boas-vindas', data: perfil.email_boas_vindas_enviado });
      }
      if (perfil.email_onboarding_dia2_enviado) {
        historico.push({ email: perfil.email, nome: perfil.nome, tipo: 'Onboarding Dia 2', data: perfil.email_onboarding_dia2_enviado });
      }
      if (perfil.email_onboarding_dia5_enviado) {
        historico.push({ email: perfil.email, nome: perfil.nome, tipo: 'Onboarding Dia 5', data: perfil.email_onboarding_dia5_enviado });
      }
      if (perfil.email_onboarding_dia7_enviado) {
        historico.push({ email: perfil.email, nome: perfil.nome, tipo: 'Onboarding Dia 7', data: perfil.email_onboarding_dia7_enviado });
      }
      if (perfil.email_inativo_enviado) {
        historico.push({ email: perfil.email, nome: perfil.nome, tipo: 'Inativo', data: perfil.email_inativo_enviado });
      }
    }

    // Ordenar por data
    historico.sort((a, b) => new Date(b.data) - new Date(a.data));

    res.json({ success: true, historico: historico.slice(0, 50) });
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// Modificar a função de automação para verificar configs
async function verificarEmailAtivo(tipo) {
  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'email_marketing')
      .single();

    if (!data || !data.valor) return true; // Se não tem config, está ativo
    return data.valor[tipo]?.ativo !== false;
  } catch {
    return true; // Em caso de erro, considera ativo
  }
}

// ================================================
// BANCO DE TÓPICOS POR ÁREA - GERAÇÃO ALEATÓRIA
// ================================================
const TOPICOS_POR_AREA = {
  'Direito Civil': [
    'Usucapião: como adquirir propriedade pela posse prolongada',
    'Responsabilidade civil por danos morais',
    'Prescrição de dívidas: prazos que você precisa conhecer',
    'Direitos do inquilino na locação de imóveis',
    'Contratos de compra e venda: cuidados essenciais',
    'Dano moral nas relações de consumo',
    'Testamento: tipos e como fazer',
    'Direito de vizinhança e conflitos entre vizinhos',
    'Doação de bens: regras e limitações',
    'Indenização por acidente de trânsito'
  ],
  'Direito Penal': [
    'Diferença entre flagrante e prisão preventiva',
    'Legítima defesa: quando é permitido se defender',
    'Crimes contra a honra: calúnia, difamação e injúria',
    'Acordo de não persecução penal',
    'Direitos do preso: o que a lei garante',
    'Violência doméstica e a Lei Maria da Penha',
    'Crimes virtuais e suas consequências',
    'Tráfico de drogas vs uso pessoal',
    'Furto vs roubo: qual a diferença',
    'Medidas protetivas de urgência'
  ],
  'Direito Trabalhista': [
    'Rescisão indireta: quando o empregado pode pedir',
    'Horas extras: cálculo e direitos',
    'Assédio moral no trabalho: como identificar',
    'Acordo trabalhista e seus limites',
    'Home office: direitos e deveres',
    'FGTS: saque e multa rescisória',
    'Estabilidade no emprego: quem tem direito',
    'Intervalo intrajornada: regras atualizadas',
    'Demissão por justa causa: motivos legais',
    'Equiparação salarial: quando exigir'
  ],
  'Direito Empresarial': [
    'MEI vs ME vs EPP: qual escolher',
    'Como proteger sua marca legalmente',
    'Sociedade entre sócios: cuidados no contrato social',
    'Recuperação judicial: quando é a saída',
    'Due diligence: o que verificar antes de comprar empresa',
    'Responsabilidade dos sócios pelas dívidas',
    'Propriedade intelectual para empresas',
    'Contratos empresariais essenciais',
    'Falência: processo e consequências',
    'Compliance empresarial: por que implementar'
  ],
  'Direito do Consumidor': [
    'Produto com defeito: troca ou reembolso',
    'Direito de arrependimento em compras online',
    'Nome negativado indevidamente: seus direitos',
    'Cobrança abusiva: como se proteger',
    'Voo atrasado ou cancelado: indenização',
    'Garantia legal vs garantia contratual',
    'Publicidade enganosa: quando processar',
    'Plano de saúde negou cobertura: o que fazer',
    'Superendividamento: nova lei e proteção',
    'Recall de produtos: obrigações da empresa'
  ],
  'Direito de Família': [
    'Divórcio consensual: passo a passo',
    'Pensão alimentícia: cálculo e revisão',
    'Guarda compartilhada: como funciona na prática',
    'Reconhecimento de paternidade: procedimento',
    'União estável: direitos garantidos',
    'Alienação parental: como identificar e combater',
    'Inventário: judicial vs extrajudicial',
    'Regime de bens no casamento',
    'Adoção: requisitos e processo',
    'Violência doméstica: medidas de proteção'
  ],
  'Direito Tributário': [
    'Como contestar auto de infração fiscal',
    'Malha fina do IR: como sair',
    'Parcelamento de dívidas tributárias',
    'ISS, ICMS, IPI: diferenças e incidência',
    'Planejamento tributário legal para empresas',
    'Simples Nacional: vantagens e limites',
    'Restituição de tributos pagos indevidamente',
    'Dívida ativa: consequências e negociação',
    'Imunidade e isenção tributária',
    'MEI e obrigações fiscais'
  ],
  'Direito Imobiliário': [
    'Documentos essenciais para comprar imóvel',
    'Distrato imobiliário: direitos do comprador',
    'Problemas com construtora: como reclamar',
    'ITBI: quando e quanto pagar',
    'Condomínio: direitos e deveres do morador',
    'Usucapião de imóvel urbano',
    'Financiamento imobiliário: cuidados antes de assinar',
    'Vício oculto em imóvel: prazo para reclamar',
    'Contrato de aluguel: cláusulas importantes',
    'Regularização de imóvel: por que é essencial'
  ],
  'Direito Previdenciário': [
    'Aposentadoria: regras atuais e de transição',
    'INSS negou benefício: como recorrer',
    'Revisão da vida toda: quem pode pedir',
    'BPC-LOAS: benefício para idosos e deficientes',
    'Auxílio-doença: requisitos e duração',
    'Aposentadoria especial por insalubridade',
    'Pensão por morte: quem tem direito',
    'Tempo de contribuição: como comprovar',
    'Aposentadoria rural: documentação necessária',
    'Auxílio-acidente: quando solicitar'
  ],
  'Direito Digital': [
    'LGPD: obrigações das empresas',
    'Vazamento de dados: responsabilidade e indenização',
    'Crimes virtuais: tipos e penas',
    'Contratos digitais: validade jurídica',
    'Direito ao esquecimento na internet',
    'E-commerce: obrigações legais do vendedor',
    'Assinatura digital vs assinatura eletrônica',
    'Cyberbullying: consequências legais',
    'Marco Civil da Internet: principais regras',
    'Proteção de dados de menores online'
  ]
};

// ================================================
// ENDPOINT: Gerar Conteúdo Aleatório
// ================================================
app.post('/api/gerar-conteudo-aleatorio', authMiddleware, limiterGeracaoConteudo, async (req, res) => {
  try {
    const { area, formato } = req.body;
    const usuario_id = req.user.id;

    if (!area || !formato) {
      return res.status(400).json({ error: 'Área e formato são obrigatórios' });
    }

    const topicos = TOPICOS_POR_AREA[area];
    if (!topicos) {
      return res.status(400).json({ error: 'Área de atuação inválida' });
    }

    // Sortear tópico aleatório
    const topicoAleatorio = topicos[Math.floor(Math.random() * topicos.length)];

    console.log(`🎲 Conteúdo aleatório: área=${area}, formato=${formato}, tópico="${topicoAleatorio}"`);

    // Gerar conteúdo via N8N/IA
    let conteudoTexto = '';
    let imagemUrl = null;

    if (formato === 'story') {
      // Gerar conteúdo de story
      const templateAleatorio = ['voce-sabia', 'estatistica', 'urgente'][Math.floor(Math.random() * 3)];

      try {
        const conteudoIA = await gerarConteudoIA(topicoAleatorio, topicoAleatorio, area, templateAleatorio);
        conteudoTexto = JSON.stringify(conteudoIA);
      } catch (iaError) {
        console.error('Erro IA, usando fallback:', iaError.message);
        const fallback = criarFallback(topicoAleatorio, area, templateAleatorio);
        conteudoTexto = JSON.stringify(fallback);
      }

      res.json({
        success: true,
        topico: topicoAleatorio,
        area,
        formato,
        template: templateAleatorio,
        conteudo: conteudoTexto,
        tipo: 'story'
      });

    } else {
      // Formato Feed - gerar texto via N8N
      const prompt = `Crie um post para Instagram Feed sobre "${topicoAleatorio}" (área: ${area}).
Público: pessoas leigas em direito | Tom: didático e acessível
⚠️ TAMANHO: 150-200 palavras
Inclua: gancho no início, informação útil, call-to-action, 8-10 hashtags relevantes.
O conteúdo deve ser informativo e fácil de entender.`;

      try {
        const response = await fetch('http://localhost:5678/webhook/juridico-working', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });

        if (!response.ok) throw new Error(`N8N erro: ${response.status}`);
        const data = await response.json();
        conteudoTexto = data.content || data.texto || '';
      } catch (n8nError) {
        console.error('Erro N8N, gerando texto padrão:', n8nError.message);
        conteudoTexto = `📌 ${topicoAleatorio}\n\nVocê sabia que este é um dos temas mais importantes do ${area}?\n\nFique atento aos seus direitos e consulte sempre um advogado especialista.\n\n#${area.replace(/\s/g, '')} #DireitosDosCidadaos #AdvogadoEspecialista`;
      }

      res.json({
        success: true,
        topico: topicoAleatorio,
        area,
        formato,
        conteudo: conteudoTexto,
        tipo: 'feed'
      });
    }

  } catch (error) {
    console.error('Erro gerar conteúdo aleatório:', error);
    res.status(500).json({ error: 'Erro ao gerar conteúdo', details: error.message });
  }
});

// ================================================
// AUTO-POST - Configuração e Geração de Agendamentos
// ================================================

// GET - Buscar configuração de auto-post do usuário
app.get('/api/auto-post/config', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('auto_post_config')
      .select('*')
      .eq('usuario_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }

    res.json({ config: data || null });
  } catch (error) {
    console.error('Erro ao buscar config auto-post:', error);
    res.status(500).json({ error: 'Erro ao buscar configuração' });
  }
});

// POST - Salvar/atualizar configuração de auto-post
app.post('/api/auto-post/config', authMiddleware, async (req, res) => {
  try {
    const { area_atuacao, formato_preferencia, horarios, ativo, instagram_account_id } = req.body;
    const usuario_id = req.user.id;

    // Verificar se usuário tem plano escritório
    const { data: perfilData } = await supabase
      .from('perfis')
      .select('plano_atual')
      .eq('id', usuario_id)
      .single();

    if (!perfilData || perfilData.plano_atual !== 'escritorio') {
      return res.status(403).json({ error: 'Recurso exclusivo do plano Escritório' });
    }

    // Verificar se tem Instagram conectado
    const { data: igConn } = await supabase
      .from('instagram_connections')
      .select('instagram_account_id')
      .eq('user_id', usuario_id)
      .single();

    if (!igConn) {
      return res.status(400).json({ error: 'Conecte seu Instagram primeiro' });
    }

    // Upsert config
    const configData = {
      usuario_id,
      instagram_account_id: instagram_account_id || igConn.instagram_account_id,
      area_atuacao: area_atuacao || 'Direito Civil',
      formato_preferencia: formato_preferencia || 'misto',
      horarios: horarios || ['09:00', '18:00'],
      ativo: ativo !== undefined ? ativo : true,
      updated_at: new Date().toISOString()
    };

    // Verificar se já existe config
    const { data: existente } = await supabase
      .from('auto_post_config')
      .select('id')
      .eq('usuario_id', usuario_id)
      .single();

    let result;
    if (existente) {
      const { data, error } = await supabase
        .from('auto_post_config')
        .update(configData)
        .eq('usuario_id', usuario_id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('auto_post_config')
        .insert(configData)
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    console.log(`✅ Auto-post config salva para usuário ${usuario_id}`);
    res.json({ success: true, config: result });
  } catch (error) {
    console.error('Erro ao salvar config auto-post:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração', details: error.message });
  }
});

// POST - Gerar agendamentos automáticos para o dia
app.post('/api/auto-post/gerar-agendamentos', async (req, res) => {
  try {
    // Autenticação por chave secreta (chamado pelo N8N cron)
    const authKey = req.headers['x-automation-key'] || req.headers['x-admin-key'];
    const authHeader = req.headers.authorization;
    let usuario_id = req.body.usuario_id;

    // Permitir chamada autenticada por token OU por chave de automação
    if (authKey === process.env.AUTOMATION_SECRET) {
      // Chamada do N8N - precisa do usuario_id no body
      if (!usuario_id) {
        return res.status(400).json({ error: 'usuario_id obrigatório para chamadas de automação' });
      }
    } else if (authHeader?.startsWith('Bearer ')) {
      // Chamada autenticada pelo usuário
      const token = authHeader.split(' ')[1];
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return res.status(401).json({ error: 'Não autorizado' });
      }
      usuario_id = user.id;
    } else {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    // Buscar config do usuário
    const { data: config } = await supabase
      .from('auto_post_config')
      .select('*')
      .eq('usuario_id', usuario_id)
      .eq('ativo', true)
      .single();

    if (!config) {
      return res.json({ success: false, message: 'Auto-post não configurado ou desativado' });
    }

    // Verificar plano escritório
    const { data: perfilData } = await supabase
      .from('perfis')
      .select('plano_atual, nome, email')
      .eq('id', usuario_id)
      .single();

    if (!perfilData || perfilData.plano_atual !== 'escritorio') {
      return res.json({ success: false, message: 'Plano escritório necessário' });
    }

    // Verificar se tem Instagram conectado
    const { data: igConn } = await supabase
      .from('instagram_connections')
      .select('instagram_account_id')
      .eq('user_id', usuario_id)
      .single();

    if (!igConn) {
      return res.json({ success: false, message: 'Instagram não conectado' });
    }

    const horarios = config.horarios || ['09:00', '18:00'];
    const area = config.area_atuacao || 'Direito Civil';
    const formatoPref = config.formato_preferencia || 'misto';
    const topicos = TOPICOS_POR_AREA[area] || TOPICOS_POR_AREA['Direito Civil'];
    const hoje = new Date();
    const agendamentosCriados = [];

    for (let i = 0; i < horarios.length; i++) {
      const horario = horarios[i];
      const [hora, minuto] = horario.split(':');

      // Data/hora do agendamento
      const dataAgendada = new Date(hoje);
      dataAgendada.setHours(parseInt(hora), parseInt(minuto), 0, 0);

      // Pular horários que já passaram
      if (dataAgendada <= new Date()) continue;

      // Escolher formato
      let formato;
      if (formatoPref === 'misto') {
        formato = i % 2 === 0 ? 'feed' : 'stories';
      } else {
        formato = formatoPref === 'stories' ? 'stories' : 'feed';
      }

      // Sortear tópico (evitar repetir)
      const topicoIndex = (Date.now() + i) % topicos.length;
      const topico = topicos[topicoIndex];

      // Gerar conteúdo
      let conteudo = '';
      try {
        if (formato === 'stories') {
          const templateAleatorio = ['voce-sabia', 'estatistica', 'urgente'][i % 3];
          const conteudoIA = await gerarConteudoIA(topico, topico, area, templateAleatorio);
          conteudo = JSON.stringify(conteudoIA);
        } else {
          const prompt = `Crie um post para Instagram Feed sobre "${topico}" (área: ${area}).
Público: pessoas leigas | Tom: didático e acessível
⚠️ TAMANHO: 150-200 palavras
Inclua: gancho, informação útil, call-to-action, 8-10 hashtags.`;

          const response = await fetch('http://localhost:5678/webhook/juridico-working', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
          });

          if (response.ok) {
            const data = await response.json();
            conteudo = data.content || data.texto || '';
          }
        }
      } catch (iaError) {
        console.error(`Erro IA para auto-post (${topico}):`, iaError.message);
        conteudo = `📌 ${topico}\n\nVocê sabia que este é um dos temas mais importantes do ${area}?\n\nConsulte sempre um advogado especialista.\n\n#${area.replace(/\s/g, '')} #Direito`;
      }

      // Criar agendamento
      const { data: agendamento, error: agError } = await supabase
        .from('agendamentos')
        .insert({
          user_id: usuario_id,
          titulo: topico,
          conteudo,
          rede_social: 'instagram',
          formato,
          data_agendada: dataAgendada.toISOString(),
          email_usuario: perfilData.email,
          nome_usuario: perfilData.nome || perfilData.email?.split('@')[0],
          status: 'pendente'
        })
        .select()
        .single();

      if (agError) {
        console.error('Erro ao criar agendamento auto:', agError);
      } else {
        agendamentosCriados.push(agendamento);
        console.log(`📅 Auto-agendamento criado: ${topico} às ${horario}`);
      }
    }

    res.json({
      success: true,
      agendamentos_criados: agendamentosCriados.length,
      detalhes: agendamentosCriados.map(a => ({
        id: a.id,
        titulo: a.titulo,
        formato: a.formato,
        data_agendada: a.data_agendada
      }))
    });

  } catch (error) {
    console.error('Erro ao gerar agendamentos auto:', error);
    res.status(500).json({ error: 'Erro ao gerar agendamentos', details: error.message });
  }
});

// GET - Listar todos os usuários com auto-post ativo (para o cron N8N)
app.get('/api/auto-post/usuarios-ativos', async (req, res) => {
  try {
    const authKey = req.headers['x-automation-key'] || req.headers['x-admin-key'];
    if (authKey !== process.env.AUTOMATION_SECRET) {
      return res.status(401).json({ error: 'Não autorizado' });
    }

    const { data, error } = await supabase
      .from('auto_post_config')
      .select('usuario_id')
      .eq('ativo', true);

    if (error) throw error;

    res.json({
      success: true,
      usuarios: (data || []).map(d => d.usuario_id)
    });
  } catch (error) {
    console.error('Erro ao listar usuários auto-post:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 Backend v2.4 - Auto Post');
  console.log('=================================');
  console.log('✅ Porta:', PORT);
  console.log('🤖 IA: ATIVA para Stories');
  console.log('📱 Stories: Textos otimizados');
  console.log('🎨 Feed: Caixas Premium com gradiente');
  console.log('✨ Badges dinâmicos por área');
  console.log('📸 Instagram OAuth: ATIVO');
  console.log('=================================');
});
