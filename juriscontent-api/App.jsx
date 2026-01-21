// =====================================================
// INSTRUÇÕES PARA App.jsx
// =====================================================
// 
// 1. Abra o arquivo App.jsx
// 2. Procure por: "const gerarStoryCompleto = async (templateId) =>"
//    (está por volta da linha 3113)
// 3. SUBSTITUA toda a função gerarStoryCompleto (até o próximo "};")
//    pelo código abaixo
// 
// =====================================================

  // Função para gerar Story completo (conteúdo + imagem) de uma vez
  const gerarStoryCompleto = async (templateId) => {
    // Validação
    if (!areaAtuacao) {
      alert('Selecione a área de atuação primeiro!');
      return;
    }
    if (!tema) {
      alert('Digite o tema primeiro!');
      return;
    }

    setTemplateStory(templateId);
    setLoadingStoryCompleto(true);

    try {
      // 1. Gerar conteúdo ESTRUTURADO por template
      console.log('📝 Gerando conteúdo estruturado para Story...');
      
      const promptsPorTemplate = {
        'voce-sabia': `Você é um advogado brasileiro especialista em marketing jurídico.

TAREFA: Criar conteúdo para Instagram Story no formato "VOCÊ SABIA?" sobre "${tema}" na área de ${areaAtuacao}.

RETORNE EXATAMENTE NESTE FORMATO JSON (sem markdown, sem explicações):
{
  "pergunta": "Pergunta curiosa e impactante (máx 60 caracteres)",
  "resposta": "Resposta clara e educativa (máx 120 caracteres)",
  "destaque": "Frase de impacto em CAPS (máx 40 caracteres)"
}

REGRAS:
- Pergunta deve gerar curiosidade
- Resposta deve educar e informar
- Destaque deve chamar atenção e gerar engajamento
- Linguagem acessível para leigos
- SEM hashtags, SEM emojis`,

        'bullets': `Você é um advogado brasileiro especialista em marketing jurídico.

TAREFA: Criar lista de direitos/dicas para Instagram Story sobre "${tema}" na área de ${areaAtuacao}.

RETORNE EXATAMENTE NESTE FORMATO JSON (sem markdown, sem explicações):
{
  "titulo": "Título impactante (máx 40 caracteres)",
  "bullets": [
    "Primeiro direito ou dica (máx 50 caracteres)",
    "Segundo direito ou dica (máx 50 caracteres)",
    "Terceiro direito ou dica (máx 50 caracteres)",
    "Quarto direito ou dica (máx 50 caracteres)"
  ],
  "cta": "Chamada para ação (máx 30 caracteres)"
}

REGRAS:
- Título deve ser direto e impactante
- Bullets devem ser informativos e úteis
- Máximo 4 bullets
- SEM hashtags, SEM emojis`,

        'estatistica': `Você é um advogado brasileiro especialista em marketing jurídico.

TAREFA: Criar conteúdo com estatística impactante para Instagram Story sobre "${tema}" na área de ${areaAtuacao}.

RETORNE EXATAMENTE NESTE FORMATO JSON (sem markdown, sem explicações):
{
  "numero": "Número ou porcentagem impactante (ex: 70%, 3 em cada 10)",
  "contexto": "O que esse número representa (máx 60 caracteres)",
  "explicacao": "Por que isso importa (máx 100 caracteres)",
  "fonte": "Fonte do dado (ex: IBGE 2024, TST)"
}

REGRAS:
- Use dados reais ou verossímeis
- Número deve causar impacto
- Explicação deve conectar com o público
- SEM hashtags, SEM emojis`,

        'urgente': `Você é um advogado brasileiro especialista em marketing jurídico.

TAREFA: Criar alerta urgente para Instagram Story sobre "${tema}" na área de ${areaAtuacao}.

RETORNE EXATAMENTE NESTE FORMATO JSON (sem markdown, sem explicações):
{
  "alerta": "Texto de alerta urgente (máx 50 caracteres)",
  "prazo": "Prazo ou data limite se aplicável (máx 30 caracteres)",
  "risco": "O que acontece se não agir (máx 80 caracteres)",
  "acao": "O que a pessoa deve fazer (máx 60 caracteres)"
}

REGRAS:
- Tom de urgência mas sem ser alarmista
- Informação deve ser útil e verdadeira
- Ação deve ser clara e executável
- SEM hashtags, SEM emojis`,

        'premium': `Você é um advogado brasileiro especialista em marketing jurídico de alto padrão.

TAREFA: Criar conteúdo premium e sofisticado para Instagram Story sobre "${tema}" na área de ${areaAtuacao}.

RETORNE EXATAMENTE NESTE FORMATO JSON (sem markdown, sem explicações):
{
  "headline": "Título elegante e sofisticado (máx 50 caracteres)",
  "insight": "Insight valioso e exclusivo (máx 120 caracteres)",
  "conclusao": "Conclusão que demonstra autoridade (máx 80 caracteres)"
}

REGRAS:
- Tom sofisticado e profissional
- Vocabulário elevado mas acessível
- Transmitir autoridade e expertise
- SEM hashtags, SEM emojis`
      };

      const promptStory = promptsPorTemplate[templateId] || promptsPorTemplate['voce-sabia'];

      const response = await fetch('https://blasterskd.com.br/api/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptStory })
      });

      if (!response.ok) throw new Error('Erro ao gerar conteúdo');
      
      const data = await response.json();
      let conteudoStory = data.content?.trim() || '';
      
      // Tentar parsear como JSON
      let conteudoEstruturado = null;
      try {
        // Remove possíveis marcadores de código
        conteudoStory = conteudoStory.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        conteudoEstruturado = JSON.parse(conteudoStory);
        console.log('✅ Conteúdo estruturado:', conteudoEstruturado);
      } catch (e) {
        console.log('⚠️ Não foi possível parsear JSON, usando texto direto');
        conteudoEstruturado = { texto: conteudoStory };
      }
      
      setConteudoGerado(JSON.stringify(conteudoEstruturado, null, 2));

      // 2. Gerar imagem do Story com dados estruturados
      console.log('📱 Gerando imagem do Story...');
      
      const storyResponse = await fetch('https://blasterskd.com.br/api/gerar-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conteudo: conteudoEstruturado,  // NOVO: enviar estruturado
          texto: conteudoStory,            // fallback
          tema: tema,
          area: areaAtuacao,
          template: templateId,
          perfil_visual: perfilVisual,
          nome_advogado: perfil?.nome || '',
          oab: perfil?.oab || '',
          telefone: perfil?.telefone || '',
          instagram: perfil?.instagram || '',
          logo: logoUser || perfil?.logo_url || ''
        })
      });

      if (!storyResponse.ok) throw new Error('Erro ao gerar imagem do Story');
      
      const storyData = await storyResponse.json();
      
      if (storyData.success && storyData.imageUrl) {
        console.log('✅ Story completo gerado:', storyData.imageUrl);
        setImagemGerada(storyData.imageUrl);
        setImagemPreview(storyData.imageUrl);
        setModoEdicao(false);
        
        // Salvar no Supabase
        if (onSalvarImagem) {
          try {
            await onSalvarImagem({
              url: storyData.imageUrl,
              tema: tema,
              area: areaAtuacao,
              tipoConteudo: tipoConteudo,
              formato: 'stories'
            });
          } catch (e) {
            console.log('⚠️ Erro ao salvar:', e);
          }
        }
      } else {
        throw new Error('Falha ao gerar Story');
      }

    } catch (error) {
      console.error('❌ Erro:', error);
      alert('Erro ao gerar Story: ' + error.message);
    } finally {
      setLoadingStoryCompleto(false);
    }
  };
