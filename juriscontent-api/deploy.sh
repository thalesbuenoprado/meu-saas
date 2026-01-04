#!/bin/bash

# ================================================
# JURISCONTENT - SCRIPT DE DEPLOY COMPLETO
# Execute: bash deploy.sh
# ================================================

echo "🚀 =========================================="
echo "   JURISCONTENT - DEPLOY"
echo "==========================================="

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ Execute como root: sudo bash deploy.sh${NC}"
    exit 1
fi

# ================================================
# PASSO 1: Criar diretórios
# ================================================
echo -e "${YELLOW}📁 Criando diretórios...${NC}"
mkdir -p /var/www/juriscontent
mkdir -p /var/www/juriscontent-api

# ================================================
# PASSO 2: Configurar Backend
# ================================================
echo -e "${YELLOW}⚙️ Configurando Backend...${NC}"
cd /var/www/juriscontent-api

# Verificar se arquivos existem
if [ ! -f "server.js" ]; then
    echo -e "${RED}❌ Arquivo server.js não encontrado em /var/www/juriscontent-api${NC}"
    echo "Faça upload dos arquivos primeiro!"
    exit 1
fi

# Instalar dependências
echo -e "${YELLOW}📦 Instalando dependências do Node...${NC}"
npm install

# Parar PM2 se já existir
pm2 delete juriscontent-api 2>/dev/null

# Iniciar com PM2
echo -e "${YELLOW}🔄 Iniciando backend com PM2...${NC}"
pm2 start server.js --name "juriscontent-api"
pm2 save
pm2 startup

# ================================================
# PASSO 3: Configurar Nginx
# ================================================
echo -e "${YELLOW}🌐 Configurando Nginx...${NC}"

# Copiar configuração
cp /var/www/juriscontent-api/nginx-juriscontent.conf /etc/nginx/sites-available/juriscontent

# Ativar site
ln -sf /etc/nginx/sites-available/juriscontent /etc/nginx/sites-enabled/

# Remover default se existir
rm -f /etc/nginx/sites-enabled/default

# Testar configuração
nginx -t

if [ $? -eq 0 ]; then
    systemctl restart nginx
    echo -e "${GREEN}✅ Nginx configurado!${NC}"
else
    echo -e "${RED}❌ Erro na configuração do Nginx${NC}"
    exit 1
fi

# ================================================
# PASSO 4: Verificar status
# ================================================
echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}✅ DEPLOY CONCLUÍDO!${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://72.62.11.134"
echo "   API:      http://72.62.11.134/api"
echo ""
echo "📋 Comandos úteis:"
echo "   pm2 logs juriscontent-api  - Ver logs do backend"
echo "   pm2 restart juriscontent-api - Reiniciar backend"
echo "   pm2 status - Ver status"
echo ""
echo "⚠️  Não esqueça de fazer upload do frontend para:"
echo "   /var/www/juriscontent"
echo ""
