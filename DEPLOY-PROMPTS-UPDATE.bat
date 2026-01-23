@echo off
echo =====================================================
echo  JURISCONTENT - Deploy Atualizacao de Prompts
echo =====================================================
echo.

cd /d C:\Users\thale\www\juriscontent

echo [1/4] Fazendo build do frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo ERRO: Falha no build do frontend!
    pause
    exit /b 1
)
echo Build concluido!
echo.

echo [2/4] Voltando para pasta principal...
cd ..

echo [3/4] Adicionando arquivos ao Git...
git add .
git status
echo.

echo [4/4] Commitando e enviando para GitHub...
git commit -m "Refatoracao de prompts para melhorar qualidade do conteudo - v2"
git push origin main
echo.

echo =====================================================
echo  DEPLOY ENVIADO!
echo =====================================================
echo.
echo O GitHub Actions ira fazer o deploy automatico.
echo Verifique em: https://github.com/thalesbuenoprado/meu-saas/actions
echo.
pause
