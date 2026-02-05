// =====================================================
// JURISCONTENT - APP.JSX COM SUPABASE
// Substitua o INÍCIO do seu App.jsx por este código
// Até a linha "// ==== MANTER DAQUI PRA BAIXO ===="
// =====================================================

import { Share2, Link2, MoreVertical } from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef } from 'react';
import { Scale, Loader2, Eye, EyeOff, LogOut, Copy, Check, Image as ImageIcon, Download, X, Lightbulb, Users, Settings, Upload, Palette, TrendingUp, Flame, RefreshCw, Sparkles, Instagram, Facebook, Linkedin, Twitter, FileText, MessageCircle, Edit3, ZoomIn, Mail, Lock, User, Award, AlertCircle, CheckCircle, Camera, Save, Phone, Trash2, ExternalLink, Calendar, Tag, FolderOpen, ChevronUp, Clock, CreditCard, Crown, Zap, Star, ChevronLeft, ChevronRight, ChevronDown, Plus, GripVertical } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONFIGURAÇÃO SUPABASE
// =====================================================
const SUPABASE_URL = 'https://cqffdxvwdijakhnvggtg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZmZkeHZ3ZGlqYWtobnZnZ3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NTM5NzcsImV4cCI6MjA4MTIyOTk3N30.hn2zUt1Ki1Xmt4hcEcBOOYN45Jcc0gG94cKEfe_usAQ';

let supabase;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase inicializado');

  // Teste rápido de conexão
  fetch(SUPABASE_URL + '/rest/v1/', {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
    }
  })
    .then(res => {
      console.log('🌐 Teste de conexão:', res.ok ? '✅ OK' : '❌ FALHOU', res.status);
    })
    .catch(err => {
      console.error('🌐 Teste de conexão FALHOU:', err.message);
    });

} catch (error) {
  console.error('❌ Erro ao inicializar Supabase:', error);
}

// =====================================================
// CONTEXTO DE AUTENTICAÇÃO
// =====================================================
const AuthContext = createContext({});

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  const [minhasImagens, setMinhasImagens] = useState([]);
  const [meusAgendamentos, setMeusAgendamentos] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function verificarAuth() {
      console.log('🔍 Verificando sessão...');

      try {
        // Timeout de 3 segundos para getSession
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout na verificação de sessão')), 3000)
        );

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

        if (!isMounted) return;

        if (error) {
          console.error('❌ Erro ao verificar sessão:', error);
          setLoading(false);
          return;
        }

        console.log('📋 Sessão:', session ? 'EXISTE' : 'NÃO EXISTE');
        if (session?.user) {
          console.log('👤 User ID:', session.user.id);
          console.log('📧 Email:', session.user.email);
        }

        setUser(session?.user ?? null);

        if (session?.user) {
          // Carregar dados em paralelo, sem bloquear
          carregarPerfil(session.user.id);
          carregarImagens(session.user.id);
          carregarAgendamentos(session.user.id);
        }

        setLoading(false);

      } catch (error) {
        console.error('❌ Timeout ou erro na autenticação:', error.message);
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    verificarAuth();

    // Listener de mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          setRecuperandoSenha(true);
        }

        setUser(session?.user ?? null);
        if (session?.user) {
          carregarPerfil(session.user.id);
          carregarImagens(session.user.id);
          carregarAgendamentos(session.user.id);
        } else {
          setPerfil(null);
          setMinhasImagens([]);
          setMeusAgendamentos([]);
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function carregarPerfil(userId) {
    try {
      console.log('👤 Carregando perfil do usuário:', userId);

      const perfilPromise = supabase
        .from('perfis')
        .select('*')
        .eq('id', userId)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao carregar perfil')), 5000)
      );

      const { data, error } = await Promise.race([perfilPromise, timeoutPromise]);

      if (error) {
        console.log('⚠️ Perfil não encontrado ou erro:', error.message);
        return;
      }

      console.log('✅ Perfil carregado:', data?.nome || data?.email);
      setPerfil(data);
    } catch (error) {
      console.log('⚠️ Erro/timeout ao carregar perfil:', error.message);
    }
  }

  async function carregarImagens(userId) {
    try {
      console.log('📷 Carregando imagens do usuário:', userId);

      const imagensPromise = supabase
        .from('imagens_geradas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ao carregar imagens')), 5000)
      );

      const { data, error } = await Promise.race([imagensPromise, timeoutPromise]);

      if (error) {
        console.error('❌ Erro ao carregar imagens:', error);
        return;
      }

      console.log('✅ Imagens carregadas:', data?.length || 0);
      setMinhasImagens(data || []);
    } catch (error) {
      console.log('⚠️ Erro/timeout ao carregar imagens:', error.message);
    }
  }

  async function fazerLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function fazerRegistro(email, password, nome, oab) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    if (data.user) {
      await new Promise(r => setTimeout(r, 500));
      await supabase.from('perfis').upsert({
        id: data.user.id,
        email,
        nome,
        oab
      });
    }
    return data;
  }

  async function loginGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
  }

  async function recuperarSenha(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
  }

  async function atualizarSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
  }

  async function fazerLogout() {
    console.log('🚪 Tentando fazer logout...');
    try {
      // Tentar logout normal com timeout de 3 segundos
      const logoutPromise = supabase.auth.signOut();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 3000)
      );

      await Promise.race([logoutPromise, timeoutPromise]);
      console.log('✅ Logout realizado');
    } catch (e) {
      console.log('⚠️ Logout travou, forçando limpeza...');
    }

    // Sempre limpar estado local
    setUser(null);
    setPerfil(null);
    setMinhasImagens([]);

    // Limpar localStorage do Supabase
    localStorage.removeItem('sb-cqffdxvwdijakhnvggtg-auth-token');

    // Forçar reload para garantir
    console.log('🔄 Recarregando página...');
    window.location.reload();
  }

  async function atualizarPerfil(updates) {
    console.log('🔄 atualizarPerfil chamado com:', Object.keys(updates));
    if (!user) {
      console.log('❌ Sem usuário para atualizar perfil');
      return;
    }

    try {
      console.log('📡 Enviando para Supabase...');

      // Timeout de 15 segundos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: Atualização demorou mais de 15 segundos')), 15000)
      );

      const updatePromise = supabase
        .from('perfis')
        .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() })
        .select()
        .single();

      const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        console.error('❌ Erro do Supabase:', error);
        throw error;
      }

      console.log('✅ Perfil atualizado:', data?.id);
      setPerfil(data);
      return data;
    } catch (error) {
      console.error('❌ Erro em atualizarPerfil:', error);
      throw error;
    }
  }

  async function uploadLogo(file) {
    console.log('📤 Processando logo...');
    if (!user) {
      console.log('❌ Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }

    try {
      console.log('📖 Lendo arquivo...');

      // Converter para base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          console.log('✅ Arquivo lido com sucesso');
          resolve(reader.result);
        };
        reader.onerror = (e) => {
          console.error('❌ Erro ao ler arquivo:', e);
          reject(e);
        };
        reader.readAsDataURL(file);
      });

      console.log('✅ Logo convertida para base64');
      console.log('📦 Tamanho:', (base64.length / 1024).toFixed(2), 'KB');

      console.log('💾 Salvando no banco...');

      // Salvar base64 diretamente no perfil
      const resultado = await atualizarPerfil({ logo_url: base64 });
      console.log('✅ Logo salva no perfil:', resultado);

      return base64;
    } catch (error) {
      console.error('❌ Erro na função uploadLogo:', error);
      throw error;
    }
  }

  async function salvarImagemGerada(imagemData) {
    console.log('💾 Tentando salvar imagem:', imagemData);
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('imagens_geradas')
        .insert({
          user_id: user.id,
          url: imagemData.url,
          tema: imagemData.tema,
          area: imagemData.area,
          tipo_conteudo: imagemData.tipoConteudo,
          formato: imagemData.formato
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao salvar no Supabase:', error);
        throw error;
      }

      console.log('✅ Imagem salva:', data);
      await carregarImagens(user.id);
      return data;
    } catch (error) {
      console.error('❌ Erro na função salvarImagemGerada:', error);
      throw error;
    }
  }

  async function deletarImagem(imagemId) {
    const { error } = await supabase
      .from('imagens_geradas')
      .delete()
      .eq('id', imagemId);
    if (error) throw error;
    await carregarImagens(user.id);
  }

  // =====================================================
  // FUNÇÕES DE AGENDAMENTO
  // =====================================================
  async function carregarAgendamentos(userId) {
    try {
      console.log('📅 Carregando agendamentos...');

      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('user_id', userId)
        .order('data_agendada', { ascending: true });

      if (error) throw error;

      console.log('✅ Agendamentos carregados:', data?.length || 0);
      setMeusAgendamentos(data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar agendamentos:', error);
    }
  }

  async function criarAgendamento(dados) {
    if (!user) throw new Error('Usuário não autenticado');

    console.log('📅 Criando agendamento:', dados);

    const { data, error } = await supabase
      .from('agendamentos')
      .insert({
        user_id: user.id,
        titulo: dados.titulo,
        conteudo: dados.conteudo,
        imagem_url: dados.imagemUrl || null,
        rede_social: dados.redeSocial || 'instagram',
        data_agendada: dados.dataAgendada,
        email_usuario: user.email,
        nome_usuario: perfil?.nome || user.email?.split('@')[0],
        status: 'pendente'
      })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Agendamento criado:', data);
    await carregarAgendamentos(user.id);
    return data;
  }

  async function cancelarAgendamento(agendamentoId) {
    if (!user) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado' })
      .eq('id', agendamentoId)
      .eq('user_id', user.id);

    if (error) throw error;

    await carregarAgendamentos(user.id);
  }

  async function deletarAgendamento(agendamentoId) {
    if (!user) throw new Error('Usuário não autenticado');

    const { error } = await supabase
      .from('agendamentos')
      .delete()
      .eq('id', agendamentoId)
      .eq('user_id', user.id);

    if (error) throw error;

    await carregarAgendamentos(user.id);
  }

  async function reagendarAgendamento(agendamentoId, novaData) {
    if (!user) throw new Error('Usuario nao autenticado');

    const { error } = await supabase
      .from('agendamentos')
      .update({ data_agendada: novaData })
      .eq('id', agendamentoId)
      .eq('user_id', user.id)
      .eq('status', 'pendente');

    if (error) throw error;

    await carregarAgendamentos(user.id);
  }

  // Função para fazer fetch autenticado
  async function fetchAuth(url, options = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error("Usuário não autenticado");
      }
      const headers = {
        ...options.headers,
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      };
      return fetch(url, { ...options, headers });
    } catch (error) {
      console.error("Erro fetchAuth:", error);
      throw error;
    }
  }

  const value = {
    user,
    perfil,
    loading,
    minhasImagens,
    meusAgendamentos,
    fazerLogin,
    fazerRegistro,
    loginGoogle,
    fazerLogout,
    recuperarSenha,
    atualizarSenha,
    recuperandoSenha,
    setRecuperandoSenha,
    atualizarPerfil,
    uploadLogo,
    salvarImagemGerada,
    deletarImagem,
    recarregarImagens: () => user && carregarImagens(user.id),
    criarAgendamento,
    cancelarAgendamento,
    deletarAgendamento,
    reagendarAgendamento,
    recarregarAgendamentos: () => user && carregarAgendamentos(user.id),
    fetchAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  return useContext(AuthContext);
}

// =====================================================
// COMPONENTES DE AGENDAMENTO
// =====================================================

function ModalAgendar({ isOpen, onClose, conteudo, imagemUrl, titulo, dataPadrao }) {
  const { criarAgendamento } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const [dataAgendada, setDataAgendada] = useState('');
  const [horaAgendada, setHoraAgendada] = useState('');
  const [redeSocial, setRedeSocial] = useState('instagram');

  const agora = new Date();
  const minDate = agora.toISOString().split('T')[0];

  useEffect(() => {
    if (isOpen) {
      setErro('');
      setSucesso(false);
      setDataAgendada('');
      setHoraAgendada('');

      if (dataPadrao) {
        setDataAgendada(dataPadrao);
        setHoraAgendada('11:00');
      } else {
        const sugestao = new Date(agora.getTime() + 2 * 60 * 60 * 1000);
        setDataAgendada(sugestao.toISOString().split('T')[0]);
        setHoraAgendada(sugestao.toTimeString().slice(0, 5));
      }
    }
  }, [isOpen, dataPadrao]);

  const handleAgendar = async () => {
    if (!dataAgendada || !horaAgendada) {
      setErro('Selecione data e hora');
      return;
    }

    const dataHora = new Date(`${dataAgendada}T${horaAgendada}:00`);

    if (dataHora <= new Date()) {
      setErro('A data/hora deve ser no futuro');
      return;
    }

    setLoading(true);
    setErro('');

    try {
      await criarAgendamento({
        titulo: titulo || 'Post Jurídico',
        conteudo: conteudo,
        imagemUrl: imagemUrl,
        redeSocial: redeSocial,
        dataAgendada: dataHora.toISOString()
      });

      setSucesso(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Erro ao agendar:', error);
      setErro(error.message || 'Erro ao criar agendamento');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-md w-full p-6 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Agendar Post</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {sucesso ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Agendado com Sucesso!</h3>
            <p className="text-slate-400">
              Você receberá um email no horário agendado com o conteúdo pronto para postar.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-slate-700/50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-400 mb-2">Conteúdo a ser enviado:</p>
              <p className="text-white text-sm line-clamp-3">{conteudo?.substring(0, 150)}...</p>
              {imagemUrl && (
                <div className="mt-2 flex items-center gap-2 text-amber-400 text-sm">
                  <ImageIcon className="w-4 h-4" />
                  <span>Imagem anexada</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Rede Social
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'instagram', icon: Instagram, label: 'Instagram' },
                  { id: 'linkedin', icon: Linkedin, label: 'LinkedIn' },
                  { id: 'facebook', icon: Facebook, label: 'Facebook' },
                ].map(rede => (
                  <button
                    key={rede.id}
                    onClick={() => setRedeSocial(rede.id)}
                    className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${redeSocial === rede.id
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                  >
                    <rede.icon className="w-4 h-4" />
                    <span className="text-sm">{rede.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={dataAgendada}
                  onChange={(e) => setDataAgendada(e.target.value)}
                  min={minDate}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Hora
                </label>
                <input
                  type="time"
                  value={horaAgendada}
                  onChange={(e) => setHoraAgendada(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-300">
                <strong>Como funciona:</strong> No horário agendado, você receberá um email
                com o conteúdo e a imagem prontos para copiar e colar na rede social escolhida.
              </p>
            </div>

            {erro && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-400">{erro}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-700 text-slate-300 rounded-xl hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAgendar}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-semibold rounded-xl hover:from-amber-400 hover:to-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Agendando...
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    Agendar
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =====================================================
// HELPERS DO CALENDARIO
// =====================================================
const MELHORES_HORARIOS = {
  instagram: {
    diasUteis: ['11h-13h', '18h-20h'],
    fimDeSemana: ['10h-12h']
  },
  linkedin: {
    diasUteis: ['7h-9h', '11h-12h'],
    diasPreferidos: [2, 3, 4],
    fimDeSemana: []
  },
  facebook: {
    diasUteis: ['13h-16h'],
    fimDeSemana: ['12h-15h']
  }
};

function getDiasDoMes(date) {
  const ano = date.getFullYear();
  const mes = date.getMonth();
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);

  const dias = [];

  const inicioDaSemana = primeiroDia.getDay();
  for (let i = inicioDaSemana - 1; i >= 0; i--) {
    const d = new Date(ano, mes, -i);
    dias.push({ date: d, mesAtual: false });
  }

  for (let i = 1; i <= ultimoDia.getDate(); i++) {
    dias.push({ date: new Date(ano, mes, i), mesAtual: true });
  }

  const restante = 7 - (dias.length % 7);
  if (restante < 7) {
    for (let i = 1; i <= restante; i++) {
      dias.push({ date: new Date(ano, mes + 1, i), mesAtual: false });
    }
  }

  return dias;
}

function dateKey(date) {
  const d = new Date(date);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function getSugestoesDia(date) {
  const diaSemana = date.getDay();
  const ehFds = diaSemana === 0 || diaSemana === 6;
  const sugestoes = [];

  if (ehFds) {
    sugestoes.push({ rede: 'Instagram', horarios: MELHORES_HORARIOS.instagram.fimDeSemana.join(', ') });
    if (MELHORES_HORARIOS.facebook.fimDeSemana.length > 0) {
      sugestoes.push({ rede: 'Facebook', horarios: MELHORES_HORARIOS.facebook.fimDeSemana.join(', ') });
    }
  } else {
    sugestoes.push({ rede: 'Instagram', horarios: MELHORES_HORARIOS.instagram.diasUteis.join(', ') });
    if (MELHORES_HORARIOS.linkedin.diasPreferidos.includes(diaSemana)) {
      sugestoes.push({ rede: 'LinkedIn', horarios: MELHORES_HORARIOS.linkedin.diasUteis.join(', ') });
    }
    sugestoes.push({ rede: 'Facebook', horarios: MELHORES_HORARIOS.facebook.diasUteis.join(', ') });
  }

  return sugestoes;
}

// =====================================================
// COMPONENTE: CALENDARIO DE AGENDAMENTOS
// =====================================================
function ModalCalendarioAgendamentos({ isOpen, onClose, onNovoAgendamento, conteudoDisponivel }) {
  const { meusAgendamentos, cancelarAgendamento, deletarAgendamento, reagendarAgendamento, recarregarAgendamentos } = useAuth();
  const [mesAtual, setMesAtual] = useState(() => new Date());
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [loading, setLoading] = useState(null);
  const [dicasAbertas, setDicasAbertas] = useState(false);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [modoMover, setModoMover] = useState(null);
  const [reagendando, setReagendando] = useState(null); // {id, data_agendada, targetDate}
  const [novoHorario, setNovoHorario] = useState('');

  useEffect(() => {
    if (isOpen) {
      recarregarAgendamentos();
      setDiaSelecionado(null);
      setModoMover(null);
      setReagendando(null);
    }
  }, [isOpen]);

  const agendamentosPorDia = useMemo(() => {
    const mapa = {};
    (meusAgendamentos || []).forEach(ag => {
      const chave = dateKey(ag.data_agendada);
      if (!mapa[chave]) mapa[chave] = [];
      mapa[chave].push(ag);
    });
    return mapa;
  }, [meusAgendamentos]);

  const diasGrid = useMemo(() => getDiasDoMes(mesAtual), [mesAtual]);

  const hoje = dateKey(new Date());

  const mesAnterior = () => setMesAtual(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const mesProximo = () => setMesAtual(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const nomeMes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const getStatusDot = (status) => {
    switch (status) {
      case 'pendente': return 'bg-yellow-400';
      case 'enviado': return 'bg-green-400';
      case 'erro': return 'bg-red-400';
      default: return 'bg-slate-500';
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pendente': return { cor: 'bg-yellow-500/20 text-yellow-400', label: 'Pendente', icon: Clock };
      case 'enviado': return { cor: 'bg-green-500/20 text-green-400', label: 'Enviado', icon: CheckCircle };
      case 'erro': return { cor: 'bg-red-500/20 text-red-400', label: 'Erro', icon: AlertCircle };
      case 'cancelado': return { cor: 'bg-slate-500/20 text-slate-400', label: 'Cancelado', icon: X };
      default: return { cor: 'bg-slate-500/20 text-slate-400', label: status, icon: Clock };
    }
  };

  const getRedeIcon = (rede) => {
    switch (rede) {
      case 'instagram': return Instagram;
      case 'linkedin': return Linkedin;
      case 'facebook': return Facebook;
      default: return Instagram;
    }
  };

  const handleDragStart = (e, ag) => {
    if (ag.status !== 'pendente') return;
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: ag.id, data_agendada: ag.data_agendada }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, diaKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(diaKey);
  };

  const handleDragLeave = () => setDragOverDate(null);

  const handleDrop = (e, targetDate) => {
    e.preventDefault();
    setDragOverDate(null);
    try {
      const dados = JSON.parse(e.dataTransfer.getData('text/plain'));
      const horaOriginal = new Date(dados.data_agendada);
      const hh = String(horaOriginal.getHours()).padStart(2, '0');
      const mm = String(horaOriginal.getMinutes()).padStart(2, '0');
      setNovoHorario(`${hh}:${mm}`);
      setReagendando({ id: dados.id, data_agendada: dados.data_agendada, targetDate });
    } catch (err) {
      console.error('Erro ao reagendar:', err);
    }
  };

  const handleMoverPara = (targetDateStr) => {
    if (!modoMover) return;
    const horaOriginal = new Date(modoMover.data_agendada);
    const hh = String(horaOriginal.getHours()).padStart(2, '0');
    const mm = String(horaOriginal.getMinutes()).padStart(2, '0');
    setNovoHorario(`${hh}:${mm}`);
    setReagendando({ id: modoMover.id, data_agendada: modoMover.data_agendada, targetDate: targetDateStr });
    setModoMover(null);
  };

  const confirmarReagendamento = async () => {
    if (!reagendando || !novoHorario) return;
    setLoading(reagendando.id);
    try {
      const [hh, mm] = novoHorario.split(':').map(Number);
      const novaData = new Date(reagendando.targetDate + 'T12:00:00');
      novaData.setHours(hh, mm, 0);
      await reagendarAgendamento(reagendando.id, novaData.toISOString());
      setReagendando(null);
    } catch (err) {
      console.error('Erro ao reagendar:', err);
    } finally {
      setLoading(null);
    }
  };

  const handleCancelar = async (id) => {
    if (!confirm('Cancelar este agendamento?')) return;
    setLoading(id);
    try { await cancelarAgendamento(id); } finally { setLoading(null); }
  };

  const handleDeletar = async (id) => {
    if (!confirm('Excluir permanentemente este agendamento?')) return;
    setLoading(id);
    try { await deletarAgendamento(id); } finally { setLoading(null); }
  };

  if (!isOpen) return null;

  const agDia = diaSelecionado ? (agendamentosPorDia[diaSelecionado] || []) : [];
  const diaSel = diaSelecionado ? new Date(diaSelecionado + 'T12:00:00') : null;
  const sugestoesDia = diaSel ? getSugestoesDia(diaSel) : [];
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">

        {/* HEADER */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <button onClick={mesAnterior} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-white capitalize min-w-[180px] text-center">{nomeMes}</h2>
            <button onClick={mesProximo} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* DICAS DE HORARIOS */}
          <div className="mx-4 sm:mx-6 mt-4">
            <button
              onClick={() => setDicasAbertas(!dicasAbertas)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/40 border border-slate-600/40 rounded-xl text-slate-300 hover:bg-slate-700/60 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium">Melhores horarios para postar</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${dicasAbertas ? 'rotate-180' : ''}`} />
            </button>
            {dicasAbertas && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Instagram */}
                <div className="p-3 bg-slate-700/40 rounded-xl border border-pink-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/15 flex items-center justify-center">
                      <Instagram className="w-4 h-4 text-pink-400" />
                    </div>
                    <span className="text-sm font-semibold text-pink-400">Instagram</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Dias uteis</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-pink-500/10 text-pink-300 rounded text-xs">11h - 13h</span>
                        <span className="px-2 py-0.5 bg-pink-500/10 text-pink-300 rounded text-xs">18h - 20h</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Fim de semana</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-pink-500/10 text-pink-300 rounded text-xs">10h - 12h</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="p-3 bg-slate-700/40 rounded-xl border border-blue-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <Linkedin className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-sm font-semibold text-blue-400">LinkedIn</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Ter a Qui</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded text-xs">7h - 9h</span>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded text-xs">11h - 12h</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Melhor dia</p>
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded text-xs">Quarta-feira</span>
                    </div>
                  </div>
                </div>

                {/* Facebook */}
                <div className="p-3 bg-slate-700/40 rounded-xl border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600/15 flex items-center justify-center">
                      <Facebook className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-sm font-semibold text-blue-500">Facebook</span>
                  </div>
                  <div className="space-y-1.5">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Dias uteis</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 bg-blue-600/10 text-blue-300 rounded text-xs">13h - 16h</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Fim de semana</p>
                      <span className="px-2 py-0.5 bg-blue-600/10 text-blue-300 rounded text-xs">12h - 15h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* GRID DO CALENDARIO */}
          <div className="px-4 sm:px-6 py-4">
            {/* Cabeçalho dias da semana */}
            <div className="grid grid-cols-7 mb-2">
              {diasSemana.map(d => (
                <div key={d} className="text-center text-xs font-medium text-slate-500 py-1">{d}</div>
              ))}
            </div>

            {/* Dias */}
            <div className="grid grid-cols-7 gap-px bg-slate-700/30 rounded-xl overflow-hidden">
              {diasGrid.map((dia, idx) => {
                const chave = dateKey(dia.date);
                const ehHoje = chave === hoje;
                const ehSelecionado = chave === diaSelecionado;
                const agsDia = agendamentosPorDia[chave] || [];
                const ehDragOver = chave === dragOverDate;
                const ehModoMover = modoMover && chave !== dateKey(modoMover.data_agendada);

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (modoMover) {
                        handleMoverPara(chave);
                      } else {
                        setDiaSelecionado(chave === diaSelecionado ? null : chave);
                      }
                    }}
                    onDragOver={(e) => handleDragOver(e, chave)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, chave)}
                    className={`relative min-h-[52px] sm:min-h-[64px] p-1 sm:p-1.5 flex flex-col items-center transition-all
                      ${dia.mesAtual ? 'bg-slate-800/80 hover:bg-slate-700/60' : 'bg-slate-800/40'}
                      ${ehHoje ? 'ring-1 ring-inset ring-amber-500/60' : ''}
                      ${ehSelecionado ? 'ring-2 ring-inset ring-amber-400 bg-amber-500/10' : ''}
                      ${ehDragOver ? 'ring-2 ring-inset ring-amber-400 bg-amber-500/20' : ''}
                      ${ehModoMover ? 'cursor-pointer hover:bg-amber-500/15 hover:ring-1 hover:ring-amber-400' : ''}
                    `}
                  >
                    <span className={`text-xs sm:text-sm leading-none ${dia.mesAtual ? (ehHoje ? 'text-amber-400 font-bold' : 'text-slate-200') : 'text-slate-600'}`}>
                      {dia.date.getDate()}
                    </span>
                    {agsDia.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-1 flex-wrap justify-center">
                        {agsDia.slice(0, 3).map((ag, i) => (
                          <span key={i} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${getStatusDot(ag.status)}`} />
                        ))}
                        {agsDia.length > 3 && (
                          <span className="text-[9px] text-slate-400 leading-none">+{agsDia.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODO MOVER ATIVO */}
          {modoMover && (
            <div className="mx-4 sm:mx-6 mb-3 px-4 py-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-between">
              <span className="text-sm text-amber-300">Clique no dia de destino para mover o agendamento</span>
              <button onClick={() => setModoMover(null)} className="text-xs text-amber-400 hover:text-amber-300 font-medium">Cancelar</button>
            </div>
          )}

          {/* PAINEL CONFIRMAR REAGENDAMENTO COM HORARIO */}
          {reagendando && (
            <div className="mx-4 sm:mx-6 mb-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-sm text-amber-200 mb-3">
                Mover para <strong className="text-white">{new Date(reagendando.targetDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400 mb-1">Novo horario</label>
                  <input
                    type="time"
                    value={novoHorario}
                    onChange={(e) => setNovoHorario(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => setReagendando(null)}
                    className="px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarReagendamento}
                    disabled={loading === reagendando.id}
                    className="px-4 py-2 bg-amber-500 text-slate-900 font-medium rounded-lg text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading === reagendando.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Confirmar
                  </button>
                </div>
              </div>
              {/* Sugestoes rapidas de horario */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {['07:00', '09:00', '11:00', '13:00', '15:00', '18:00', '20:00'].map(h => (
                  <button
                    key={h}
                    onClick={() => setNovoHorario(h)}
                    className={`px-2.5 py-1 rounded-md text-xs transition-colors ${novoHorario === h ? 'bg-amber-500 text-slate-900 font-medium' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PAINEL DETALHES DO DIA */}
          {diaSelecionado && diaSel && (
            <div className="mx-4 sm:mx-6 mb-4 bg-slate-700/40 rounded-xl border border-slate-600/50 overflow-hidden">
              <div className="p-4 border-b border-slate-600/30">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    {diaSel.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  {sugestoesDia.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {sugestoesDia.map((s, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-300">
                          {s.rede} {s.horarios}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4">
                {agDia.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-3">Nenhum agendamento neste dia</p>
                ) : (
                  <div className="space-y-2">
                    {agDia.map(ag => {
                      const statusConfig = getStatusConfig(ag.status);
                      const RedeIcon = getRedeIcon(ag.rede_social);
                      const StatusIcon = statusConfig.icon;
                      const hora = new Date(ag.data_agendada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={ag.id}
                          draggable={ag.status === 'pendente'}
                          onDragStart={(e) => handleDragStart(e, ag)}
                          className={`flex items-center gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-600/30 group ${ag.status === 'pendente' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                          <RedeIcon className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{ag.titulo}</p>
                            <p className="text-xs text-slate-500 truncate">{ag.conteudo?.substring(0, 60)}...</p>
                          </div>
                          <span className="text-xs text-slate-400 shrink-0">{hora}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 shrink-0 ${statusConfig.cor}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {ag.status === 'pendente' && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setModoMover(ag); }}
                                  className="p-1 text-slate-500 hover:text-amber-400 rounded sm:hidden transition-colors"
                                  title="Mover"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCancelar(ag.id); }}
                                  disabled={loading === ag.id}
                                  className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                                  title="Cancelar"
                                >
                                  {loading === ag.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                </button>
                              </>
                            )}
                            {ag.status !== 'pendente' && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeletar(ag.id); }}
                                disabled={loading === ag.id}
                                className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                                title="Excluir"
                              >
                                {loading === ag.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            {ag.status === 'pendente' && (
                              <div className="hidden sm:block p-1 text-slate-600 group-hover:text-slate-400 transition-colors">
                                <GripVertical className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Botao novo agendamento */}
                <div className="mt-4 pt-3 border-t border-slate-600/30">
                  <button
                    onClick={() => onNovoAgendamento && onNovoAgendamento(diaSelecionado)}
                    className="w-full p-3 rounded-xl border border-dashed border-slate-600 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                        <Plus className="w-4 h-4 text-amber-400" />
                      </div>
                      <span className="text-sm font-medium text-slate-300 group-hover:text-amber-400 transition-colors">Agendar novo post</span>
                    </div>
                    {conteudoDisponivel ? (
                      <p className="text-[11px] text-green-400/70 mt-1">Conteudo pronto - clique para agendar</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">Fechar e gerar um conteudo primeiro</p>
                    )}
                    {sugestoesDia.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                        {sugestoesDia.map((s, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                            {s.rede} {s.horarios}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// =====================================================
// COMPONENTE: RETORNO DO MERCADO PAGO
// =====================================================
function RetornoPagamento({ tipo, onFechar }) {
  const configs = {
    sucesso: {
      icone: <CheckCircle className="w-20 h-20 text-green-500" />,
      titulo: 'Pagamento Confirmado!',
      mensagem: 'Sua assinatura foi ativada com sucesso. Agora você tem acesso a todos os recursos do seu plano.',
      cor: 'green',
      botao: 'Começar a Criar'
    },
    erro: {
      icone: <AlertCircle className="w-20 h-20 text-red-500" />,
      titulo: 'Pagamento não Concluído',
      mensagem: 'Houve um problema com o pagamento. Por favor, tente novamente ou escolha outra forma de pagamento.',
      cor: 'red',
      botao: 'Tentar Novamente'
    },
    pendente: {
      icone: <Clock className="w-20 h-20 text-amber-500" />,
      titulo: 'Pagamento Pendente',
      mensagem: 'Seu pagamento está sendo processado. Para PIX ou boleto, aguarde a confirmação. Você receberá um email quando for aprovado.',
      cor: 'amber',
      botao: 'Entendi'
    }
  };

  const config = configs[tipo] || configs.erro;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="flex justify-center mb-6">
          {config.icone}
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-4">
          {config.titulo}
        </h1>

        <p className="text-slate-600 mb-8">
          {config.mensagem}
        </p>

        <button
          onClick={onFechar}
          className={`w-full py-3 px-6 rounded-xl font-semibold text-white transition-all
            ${tipo === 'sucesso' ? 'bg-green-500 hover:bg-green-600' : ''}
            ${tipo === 'erro' ? 'bg-red-500 hover:bg-red-600' : ''}
            ${tipo === 'pendente' ? 'bg-amber-500 hover:bg-amber-600' : ''}
          `}
        >
          {config.botao}
        </button>

        {tipo === 'pendente' && (
          <p className="text-sm text-slate-500 mt-4">
            O prazo para pagamento via PIX é de 30 minutos. Via boleto, até 3 dias úteis.
          </p>
        )}

        {tipo === 'erro' && (
          <p className="text-sm text-slate-500 mt-4">
            Precisa de ajuda? Entre em contato pelo suporte.
          </p>
        )}
      </div>
    </div>
  );
}

// =====================================================
// TERMOS DE USO
// =====================================================
function TermosDeUso() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} className="mb-6 text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1">&larr; Voltar</button>
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-6">Termos de Uso</h1>
          <p className="text-slate-400 text-sm mb-6">Ultima atualizacao: 05 de fevereiro de 2025</p>
          <div className="space-y-6 text-slate-300 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Aceitacao dos Termos</h2>
              <p>Ao acessar e utilizar a plataforma JurisContent ("Plataforma"), voce concorda com estes Termos de Uso. Se nao concordar, nao utilize a Plataforma. O uso continuado constitui aceitacao integral destes termos.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Descricao do Servico</h2>
              <p>O JurisContent e uma plataforma SaaS (Software as a Service) que oferece ferramentas de geracao de conteudo visual para profissionais do Direito, incluindo:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Geracao de imagens para redes sociais (feed e stories)</li>
                <li>Geracao de conteudo textual com auxilio de inteligencia artificial</li>
                <li>Personalizacao visual com logotipo e paleta de cores</li>
                <li>Galeria de imagens geradas</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. Cadastro e Conta</h2>
              <p>Para utilizar a Plataforma, voce deve criar uma conta fornecendo informacoes verdadeiras e completas. Voce e responsavel por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">4. Planos e Pagamentos</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>A Plataforma oferece planos gratuitos e pagos com diferentes limites de geracao.</li>
                <li>Os pagamentos sao processados pelo Mercado Pago. Ao efetuar um pagamento, voce concorda com os termos do processador de pagamentos.</li>
                <li>Os planos pagos tem validade de 30 dias a partir da data de aprovacao do pagamento.</li>
                <li>Nao ha reembolso automatico. Solicitacoes de reembolso devem ser feitas pelo email de suporte.</li>
                <li>Os precos podem ser alterados com aviso previo de 30 dias.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">5. Uso do Conteudo Gerado</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>O conteudo gerado pela Plataforma e de uso do usuario que o criou.</li>
                <li>O usuario e integralmente responsavel pela revisao, verificacao juridica e publicacao do conteudo.</li>
                <li>O conteudo gerado por IA tem carater informativo e nao substitui consultoria juridica profissional.</li>
                <li>A Plataforma nao se responsabiliza por erros, imprecisoes ou uso inadequado do conteudo gerado.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">6. Propriedade Intelectual</h2>
              <p>A Plataforma, sua marca, codigo-fonte, design e funcionalidades sao propriedade exclusiva do JurisContent. E proibida a reproducao, copia ou engenharia reversa sem autorizacao expressa.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">7. Limitacao de Responsabilidade</h2>
              <p>A Plataforma e fornecida "como esta". Nao garantimos disponibilidade ininterrupta, ausencia de erros ou adequacao a finalidades especificas. Em nenhuma hipotese seremos responsaveis por danos indiretos, incidentais ou consequentes decorrentes do uso da Plataforma.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">8. Cancelamento e Suspensao</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>O usuario pode cancelar sua conta a qualquer momento.</li>
                <li>Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos.</li>
                <li>Em caso de cancelamento, os dados serao mantidos por 30 dias e depois excluidos permanentemente.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">9. Alteracoes nos Termos</h2>
              <p>Podemos alterar estes Termos a qualquer momento. Alteracoes significativas serao comunicadas por email ou notificacao na Plataforma. O uso continuado apos as alteracoes constitui aceitacao dos novos termos.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">10. Contato</h2>
              <p>Para duvidas sobre estes Termos, entre em contato pelo email: <a href="mailto:contato@juriscontent.com.br" className="text-amber-400 hover:underline">contato@juriscontent.com.br</a></p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">11. Foro</h2>
              <p>Estes Termos sao regidos pelas leis da Republica Federativa do Brasil. Fica eleito o foro da comarca do domicilio do usuario para dirimir quaisquer controversias.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// POLITICA DE PRIVACIDADE
// =====================================================
function PoliticaPrivacidade() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <button onClick={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} className="mb-6 text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1">&larr; Voltar</button>
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-slate-700">
          <h1 className="text-2xl font-bold text-white mb-6">Politica de Privacidade</h1>
          <p className="text-slate-400 text-sm mb-6">Ultima atualizacao: 05 de fevereiro de 2025</p>
          <p className="text-slate-300 text-sm mb-6">Esta Politica de Privacidade descreve como o JurisContent coleta, utiliza, armazena e protege seus dados pessoais, em conformidade com a Lei Geral de Protecao de Dados (LGPD - Lei 13.709/2018).</p>
          <div className="space-y-6 text-slate-300 text-sm leading-relaxed">

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Dados Coletados</h2>
              <p>Coletamos os seguintes dados pessoais:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Dados de cadastro:</strong> nome, email, numero da OAB (opcional), telefone (opcional)</li>
                <li><strong className="text-white">Dados de uso:</strong> conteudos gerados, imagens criadas, preferencias de estilo</li>
                <li><strong className="text-white">Dados de pagamento:</strong> processados pelo Mercado Pago (nao armazenamos dados de cartao)</li>
                <li><strong className="text-white">Dados tecnicos:</strong> IP, navegador, logs de acesso</li>
                <li><strong className="text-white">Logo/imagem:</strong> logotipo enviado pelo usuario para personalizacao</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Finalidade do Tratamento</h2>
              <p>Utilizamos seus dados para:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Fornecer e operar a Plataforma</li>
                <li>Gerar conteudo personalizado com seu nome e logotipo</li>
                <li>Processar pagamentos e gerenciar assinaturas</li>
                <li>Enviar comunicacoes sobre sua conta (confirmacoes, alertas)</li>
                <li>Melhorar a qualidade do servico</li>
                <li>Cumprir obrigacoes legais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">3. Base Legal (LGPD)</h2>
              <p>O tratamento dos dados e realizado com base em:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Execucao de contrato:</strong> para fornecer o servico contratado</li>
                <li><strong className="text-white">Consentimento:</strong> para envio de comunicacoes de marketing</li>
                <li><strong className="text-white">Interesse legitimo:</strong> para melhorias no servico e seguranca</li>
                <li><strong className="text-white">Obrigacao legal:</strong> para cumprimento de legislacao aplicavel</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">4. Compartilhamento de Dados</h2>
              <p>Seus dados podem ser compartilhados com:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong className="text-white">Mercado Pago:</strong> processamento de pagamentos</li>
                <li><strong className="text-white">Supabase:</strong> armazenamento seguro de dados (servidores na AWS)</li>
                <li><strong className="text-white">Cloudinary:</strong> armazenamento de imagens geradas</li>
                <li><strong className="text-white">Provedores de IA:</strong> para geracao de conteudo (dados anonimizados)</li>
              </ul>
              <p className="mt-2">Nao vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins de marketing.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">5. Armazenamento e Seguranca</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Dados armazenados em servidores seguros com criptografia</li>
                <li>Acesso restrito a dados pessoais</li>
                <li>Comunicacoes protegidas por HTTPS/SSL</li>
                <li>Senhas armazenadas com hash criptografico (nunca em texto plano)</li>
                <li>Backups regulares com retencao de 30 dias</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">6. Seus Direitos (LGPD Art. 18)</h2>
              <p>Voce tem direito a:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Confirmar a existencia de tratamento de seus dados</li>
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar anonimizacao ou exclusao de dados desnecessarios</li>
                <li>Solicitar portabilidade dos dados</li>
                <li>Revogar consentimento a qualquer momento</li>
                <li>Solicitar exclusao dos dados pessoais (direito ao esquecimento)</li>
              </ul>
              <p className="mt-2">Para exercer seus direitos, envie email para: <a href="mailto:contato@juriscontent.com.br" className="text-amber-400 hover:underline">contato@juriscontent.com.br</a></p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">7. Cookies</h2>
              <p>Utilizamos cookies essenciais para autenticacao e funcionamento da Plataforma. Nao utilizamos cookies de rastreamento ou publicidade de terceiros.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">8. Retencao de Dados</h2>
              <ul className="list-disc pl-5 space-y-1">
                <li>Dados de conta: mantidos enquanto a conta estiver ativa</li>
                <li>Imagens geradas: mantidas ate exclusao pelo usuario ou cancelamento da conta</li>
                <li>Dados de pagamento: mantidos por 5 anos (obrigacao fiscal)</li>
                <li>Apos cancelamento: dados excluidos em ate 30 dias, exceto obrigacoes legais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">9. Menores de Idade</h2>
              <p>A Plataforma nao e destinada a menores de 18 anos. Nao coletamos intencionalmente dados de menores. Se identificarmos dados de menores, estes serao excluidos imediatamente.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">10. Alteracoes nesta Politica</h2>
              <p>Esta Politica pode ser atualizada periodicamente. Alteracoes significativas serao comunicadas por email. Recomendamos a revisao periodica desta pagina.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-white mb-2">11. Contato do Encarregado (DPO)</h2>
              <p>Para questoes relacionadas a protecao de dados pessoais:</p>
              <p className="mt-1">Email: <a href="mailto:contato@juriscontent.com.br" className="text-amber-400 hover:underline">contato@juriscontent.com.br</a></p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// COMPONENTE PRINCIPAL APP
// =====================================================
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, perfil, loading, fazerLogout, minhasImagens, salvarImagemGerada, recuperandoSenha } = useAuth();
  const [mostrarGaleria, setMostrarGaleria] = useState(false);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const [retornoPagamento, setRetornoPagamento] = useState(null);

  // Detectar retorno do Mercado Pago
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/pagamento/sucesso')) {
      setRetornoPagamento('sucesso');
    } else if (path.includes('/pagamento/erro')) {
      setRetornoPagamento('erro');
    } else if (path.includes('/pagamento/pendente')) {
      setRetornoPagamento('pendente');
    }
  }, []);

  // Fechar modal de retorno e limpar URL
  const fecharRetornoPagamento = () => {
    setRetornoPagamento(null);
    window.history.replaceState({}, '', '/');
  };

  // Páginas públicas (acessíveis sem login)
  const path = window.location.pathname;
  if (path === '/termos') return <TermosDeUso />;
  if (path === '/privacidade') return <PoliticaPrivacidade />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="w-16 h-16 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!user || recuperandoSenha) {
    return <LoginSupabase />;
  }

  // Mostrar página de retorno do Mercado Pago
  if (retornoPagamento) {
    return <RetornoPagamento tipo={retornoPagamento} onFechar={fecharRetornoPagamento} />;
  }

  // Converter perfil para formato esperado pelo CriadorCompleto
  const userData = {
    nome: perfil?.nome || user.email?.split('@')[0] || 'Usuário',
    oab: user?.oab || '',
    logo: perfil?.logo_url || null,
    email: user.email
  };

  return (
    <>
      <CriadorCompleto
        user={userData}
        onLogout={fazerLogout}
        onAbrirGaleria={() => setMostrarGaleria(true)}
        onAbrirPerfil={() => setMostrarPerfil(true)}
        onAbrirPlanos={() => setMostrarPlanos(true)}
        onSalvarImagem={salvarImagemGerada}
      />

      <GaleriaImagensModal
        isOpen={mostrarGaleria}
        onClose={() => setMostrarGaleria(false)}
      />

      <PerfilUsuarioModal
        isOpen={mostrarPerfil}
        onClose={() => setMostrarPerfil(false)}
      />

      <PlanosModal
        isOpen={mostrarPlanos}
        onClose={() => setMostrarPlanos(false)}
      />
    </>
  );
}

// =====================================================
// TELA DE LOGIN SUPABASE
// =====================================================
function LoginSupabase() {
  const { fazerLogin, fazerRegistro, loginGoogle, recuperarSenha, atualizarSenha, recuperandoSenha, setRecuperandoSenha } = useAuth();

  const [modo, setModo] = useState('login'); // 'login' | 'registro' | 'recuperar' | 'nova-senha'
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [nome, setNome] = useState('');
  const [oab, setOab] = useState('');

  // Quando Supabase detecta PASSWORD_RECOVERY, mudar para tela de nova senha
  useEffect(() => {
    if (recuperandoSenha) {
      setModo('nova-senha');
    }
  }, [recuperandoSenha]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso('');
    setLoading(true);

    try {
      if (modo === 'login') {
        await fazerLogin(email, senha);
      } else if (modo === 'registro') {
        if (!nome.trim()) throw new Error('Nome é obrigatório');
        const result = await fazerRegistro(email, senha, nome, oab);
        if (result.user && !result.session) {
          setSucesso('Conta criada! Verifique seu email para confirmar.');
          setModo('login');
        }
      } else if (modo === 'recuperar') {
        if (!email.trim()) throw new Error('Informe seu email');
        await recuperarSenha(email);
        setSucesso('Email enviado! Verifique sua caixa de entrada e spam.');
      } else if (modo === 'nova-senha') {
        if (senha.length < 6) throw new Error('Senha deve ter no mínimo 6 caracteres');
        if (senha !== confirmarSenha) throw new Error('As senhas não conferem');
        await atualizarSenha(senha);
        setRecuperandoSenha(false);
        setSucesso('Senha alterada com sucesso!');
        setModo('login');
        setSenha('');
        setConfirmarSenha('');
      }
    } catch (error) {
      if (error.message.includes('Invalid login')) setErro('Email ou senha incorretos');
      else if (error.message.includes('already registered')) setErro('Este email já está cadastrado');
      else if (error.message.includes('at least 6')) setErro('Senha deve ter no mínimo 6 caracteres');
      else setErro(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mb-4 shadow-lg">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">JurisContent</h1>
          <p className="text-slate-400">Conteúdo jurídico profissional</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-8 border border-slate-700">

          {/* Tabs - esconder quando recuperando/nova senha */}
          {(modo === 'login' || modo === 'registro') && (
            <div className="flex mb-6 bg-slate-900/50 rounded-lg p-1">
              <button
                onClick={() => { setModo('login'); setErro(''); setSucesso(''); }}
                className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${modo === 'login' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Entrar
              </button>
              <button
                onClick={() => { setModo('registro'); setErro(''); setSucesso(''); }}
                className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all ${modo === 'registro' ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                Criar Conta
              </button>
            </div>
          )}

          {/* Titulo para recuperar/nova senha */}
          {modo === 'recuperar' && (
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-white mb-1">Recuperar Senha</h2>
              <p className="text-slate-400 text-sm">Informe seu email para receber o link de recuperação</p>
            </div>
          )}
          {modo === 'nova-senha' && (
            <div className="mb-6 text-center">
              <h2 className="text-lg font-semibold text-white mb-1">Definir Nova Senha</h2>
              <p className="text-slate-400 text-sm">Escolha sua nova senha</p>
            </div>
          )}

          {/* Mensagens */}
          {erro && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              {sucesso}
            </div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {modo === 'registro' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Nome Completo *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Dr. João Silva"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">OAB (opcional)</label>
                  <div className="relative">
                    <Award className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={oab}
                      onChange={(e) => setOab(e.target.value)}
                      placeholder="OAB/SP 123456"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email - mostrar em login, registro e recuperar */}
            {modo !== 'nova-senha' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                  />
                </div>
              </div>
            )}

            {/* Senha - mostrar em login, registro e nova-senha */}
            {modo !== 'recuperar' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  {modo === 'nova-senha' ? 'Nova Senha *' : 'Senha *'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-12 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {mostrarSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Confirmar senha - apenas nova-senha */}
            {modo === 'nova-senha' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar Nova Senha *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={mostrarSenha ? 'text' : 'password'}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    required
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {/* Link "Esqueci minha senha" - apenas na tela de login */}
            {modo === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setModo('recuperar'); setErro(''); setSucesso(''); }}
                  className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              {loading ? 'Aguarde...' :
                modo === 'login' ? 'Entrar' :
                modo === 'registro' ? 'Criar Conta' :
                modo === 'recuperar' ? 'Enviar Email' :
                'Salvar Nova Senha'}
            </button>
          </form>

          {/* Link voltar - para recuperar e nova-senha */}
          {(modo === 'recuperar' || modo === 'nova-senha') && (
            <button
              onClick={() => { setModo('login'); setErro(''); setSucesso(''); setRecuperandoSenha(false); }}
              className="w-full mt-4 text-sm text-slate-400 hover:text-white transition-colors text-center"
            >
              Voltar para o login
            </button>
          )}

          {/* Divisor e Google - apenas login/registro */}
          {(modo === 'login' || modo === 'registro') && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-slate-800/50 text-slate-400">ou</span>
                </div>
              </div>

              <button
                onClick={loginGoogle}
                disabled={loading}
                className="w-full bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continuar com Google
              </button>
            </>
          )}

          {/* Links legais */}
          <div className="mt-6 pt-4 border-t border-slate-700 flex justify-center gap-4 text-xs text-slate-500">
            <a href="/termos" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
            <span>|</span>
            <a href="/privacidade" className="hover:text-slate-300 transition-colors">Politica de Privacidade</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MODAL GALERIA DE IMAGENS
// =====================================================
function GaleriaImagensModal({ isOpen, onClose }) {
  const { minhasImagens, deletarImagem } = useAuth();
  const [selecionada, setSelecionada] = useState(null);
  const [deletando, setDeletando] = useState(null);

  if (!isOpen) return null;

  const handleDeletar = async (id) => {
    if (!confirm('Excluir esta imagem?')) return;
    setDeletando(id);
    try {
      await deletarImagem(id);
      if (selecionada?.id === id) setSelecionada(null);
    } catch (e) {
      alert('Erro ao excluir');
    }
    setDeletando(null);
  };

  const formatarData = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Minhas Imagens ({minhasImagens.length})</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex h-[calc(85vh-70px)]">
          {/* Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            {minhasImagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <ImageIcon className="w-16 h-16 mb-4 opacity-30" />
                <p>Nenhuma imagem gerada ainda</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {minhasImagens.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelecionada(img)}
                    className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${selecionada?.id === img.id ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700 hover:border-slate-600'
                      }`}
                  >
                    <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-xs truncate">{img.tema || 'Sem título'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes */}
          {selecionada && (
            <div className="w-72 border-l border-slate-700 p-4 overflow-y-auto bg-slate-900/50">
              <img src={selecionada.url} alt="" className="w-full rounded-lg mb-4" />

              {selecionada.tema && <p className="text-white font-medium mb-2">{selecionada.tema}</p>}
              {selecionada.area && (
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <Tag className="w-4 h-4" />
                  {selecionada.area}
                </div>
              )}
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                <Calendar className="w-4 h-4" />
                {formatarData(selecionada.created_at)}
              </div>

              <div className="space-y-2">
                <a
                  href={selecionada.url}
                  download
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </a>
                <button
                  onClick={() => handleDeletar(selecionada.id)}
                  disabled={deletando === selecionada.id}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 rounded-lg"
                >
                  {deletando === selecionada.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Excluir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =====================================================
// MODAL PERFIL DO USUÁRIO
// =====================================================
function PerfilUsuarioModal({ isOpen, onClose }) {
  const { user, perfil, atualizarPerfil, uploadLogo, minhasImagens, fetchAuth } = useAuth();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removendoFundo, setRemovendoFundo] = useState(false);
  const [msg, setMsg] = useState({ tipo: '', texto: '' });

  const [nome, setNome] = useState(perfil?.nome || '');
  const [oab, setOab] = useState(user?.oab || '');
  const [telefone, setTelefone] = useState(user?.telefone || '');

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome || '');
      setOab(perfil.oab || '');
      setTelefone(perfil.telefone || '');
    }
  }, [perfil]);

  if (!isOpen) return null;

  const handleSalvar = async () => {
    setLoading(true);
    setMsg({ tipo: '', texto: '' });
    try {
      await atualizarPerfil({ nome, oab, telefone });
      setMsg({ tipo: 'sucesso', texto: 'Perfil salvo!' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: 'Erro ao salvar' });
    }
    setLoading(false);
  };

  // Função para remover fundo via servidor local
  const removerFundoLogo = async (base64) => {
    try {
      console.log('🎨 Removendo fundo da logo...');
      const response = await fetchAuth('https://blasterskd.com.br/api/remover-fundo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logo: base64 })
      });

      const data = await response.json();

      if (data.success && data.logoSemFundo) {
        console.log('✅ Fundo removido com sucesso!');
        return 'data:image/png;base64,' + data.logoSemFundo;
      } else {
        throw new Error(data.error || 'Falha ao remover fundo');
      }
    } catch (error) {
      console.error('❌ Erro ao remover fundo:', error);
      throw error;
    }
  };

  const handleLogo = async (e, comRemocaoDeFundo = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ tipo: 'erro', texto: 'Máximo 2MB' });
      return;
    }

    setUploading(true);
    setMsg({ tipo: '', texto: '' });

    try {
      if (comRemocaoDeFundo) {
        setRemovendoFundo(true);
        setMsg({ tipo: '', texto: 'Removendo fundo...' });

        // Converter para base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Remover fundo
        const logoSemFundo = await removerFundoLogo(base64);

        // Salvar logo sem fundo
        await atualizarPerfil({ logo_url: logoSemFundo });
        setMsg({ tipo: 'sucesso', texto: 'Logo atualizada (sem fundo)!' });
      } else {
        await uploadLogo(file);
        setMsg({ tipo: 'sucesso', texto: 'Logo atualizada!' });
      }
    } catch (e) {
      console.error('Erro no handleLogo:', e);
      setMsg({ tipo: 'erro', texto: 'Erro: ' + (e.message || 'Falha no upload') });
    }

    setUploading(false);
    setRemovendoFundo(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden border border-slate-700">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" />
            Meu Perfil
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {msg.texto && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${msg.tipo === 'sucesso' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
              {msg.tipo === 'sucesso' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {msg.texto}
            </div>
          )}

          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-xl bg-slate-700 border-2 border-slate-600 overflow-hidden flex items-center justify-center">
                {perfil?.logo_url ? (
                  <img src={perfil.logo_url} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Camera className="w-8 h-8 text-slate-500" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <p className="text-white font-medium mb-1">Logo</p>
              <p className="text-slate-400 text-xs mb-2">PNG ou JPG, máx 2MB</p>

              {/* Botões de upload */}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogo(e, false)}
                  className="hidden"
                  id="logo-normal"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogo(e, true)}
                  className="hidden"
                  id="logo-sem-fundo"
                />

                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  Upload Normal
                </button>

                <button
                  onClick={() => document.getElementById('logo-sem-fundo')?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
                >
                  {removendoFundo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {removendoFundo ? 'Removendo...' : 'Remover Fundo ✨'}
                </button>
              </div>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                value={user?.email || ''}
                readOnly
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-400"
              />
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-400 outline-none"
            />
          </div>

          {/* OAB */}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">OAB</label>
            <input
              value={oab}
              onChange={(e) => setOab(e.target.value)}
              placeholder="OAB/SP 123456"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-400 outline-none"
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm text-slate-300 mb-1.5">Telefone</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(11) 99999-9999"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-amber-400 outline-none"
            />
          </div>

          {/* Stats */}
          <div className="pt-3 border-t border-slate-700 text-slate-400 text-sm">
            <ImageIcon className="w-4 h-4 inline mr-2" />
            {minhasImagens.length} imagens geradas
          </div>

          {/* Salvar */}
          <button
            onClick={handleSalvar}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ====================================
// MODAL DE PLANOS E ASSINATURA
// ====================================
function PlanosModal({ isOpen, onClose }) {
  const { fetchAuth, perfil } = useAuth();
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assinatura, setAssinatura] = useState(null);
  const [uso, setUso] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (isOpen) {
      carregarDados();
    }
  }, [isOpen]);

  const carregarDados = async () => {
    setLoading(true);
    setErro('');
    try {
      // Carregar planos e assinatura em paralelo
      const [planosRes, assinaturaRes] = await Promise.all([
        fetch('https://blasterskd.com.br/api/planos'),
        fetchAuth('https://blasterskd.com.br/api/minha-assinatura')
      ]);

      const planosData = await planosRes.json();
      const assinaturaData = await assinaturaRes.json();

      if (planosData.success) {
        setPlanos(planosData.planos || []);
      }
      if (assinaturaData.success) {
        setAssinatura(assinaturaData.assinatura);
        setUso(assinaturaData.uso);
      }
    } catch (e) {
      console.error('Erro ao carregar planos:', e);
      setErro('Erro ao carregar informações');
    }
    setLoading(false);
  };

  const handleAssinar = async (planoSlug) => {
    // Se tem assinatura ativa e está tentando ir para plano grátis, bloquear
    if (planoSlug === 'gratis' && assinatura?.status === 'ativa') {
      setErro('Você possui uma assinatura ativa. Cancele primeiro antes de mudar para o plano grátis.');
      return;
    }

    // Se tem assinatura ativa e clica em outro plano pago, avisar
    if (assinatura?.status === 'ativa' && planoSlug !== 'gratis') {
      if (!confirm(`Você já possui o plano ${planoAtual}. Deseja fazer upgrade para o plano ${planoSlug}? Seu plano atual será substituído após o pagamento.`)) {
        return;
      }
    }

    setProcessando(true);
    setErro('');
    try {
      const response = await fetchAuth('https://blasterskd.com.br/api/criar-assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano_slug: planoSlug })
      });

      const data = await response.json();

      if (data.success) {
        if (data.init_point) {
          // Redirecionar para checkout do Mercado Pago
          window.location.href = data.init_point;
        } else {
          // Plano grátis ativado
          await carregarDados();
        }
      } else {
        setErro(data.error || 'Erro ao processar assinatura');
      }
    } catch (e) {
      setErro('Erro ao conectar com o servidor');
    }
    setProcessando(false);
  };

  const handleCancelar = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura?')) return;

    setProcessando(true);
    try {
      const response = await fetchAuth('https://blasterskd.com.br/api/cancelar-assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: 'Cancelado pelo usuário' })
      });

      const data = await response.json();
      if (data.success) {
        await carregarDados();
      } else {
        setErro(data.error || 'Erro ao cancelar');
      }
    } catch (e) {
      setErro('Erro ao conectar com o servidor');
    }
    setProcessando(false);
  };

  if (!isOpen) return null;

  const planoAtual = perfil?.plano_atual || 'gratis';

  const getIconePlano = (slug) => {
    switch (slug) {
      case 'gratis': return <Zap className="w-6 h-6" />;
      case 'essencial': return <Star className="w-6 h-6" />;
      case 'profissional': return <Award className="w-6 h-6" />;
      case 'escritorio': return <Crown className="w-6 h-6" />;
      default: return <Zap className="w-6 h-6" />;
    }
  };

  const getCorPlano = (slug) => {
    switch (slug) {
      case 'gratis': return 'from-slate-500 to-slate-600';
      case 'essencial': return 'from-blue-500 to-blue-600';
      case 'profissional': return 'from-amber-500 to-amber-600';
      case 'escritorio': return 'from-purple-500 to-purple-600';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-amber-400" />
            <h2 className="text-xl font-bold text-white">Planos e Assinatura</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Uso atual */}
              {uso && (
                <div className="mb-6 p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-slate-300 font-medium">Seu uso este mês</span>
                    <span className="text-amber-400 font-bold capitalize">{planoAtual}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-3 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                          style={{
                            width: uso.limite === 0 ? '10%' : `${Math.min((uso.geracoes_usadas / uso.limite) * 100, 100)}%`
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-white font-medium min-w-[100px] text-right">
                      {uso.geracoes_usadas} / {uso.limite === 0 ? '∞' : uso.limite} posts
                    </span>
                  </div>
                  {uso.restante !== -1 && uso.restante <= 3 && uso.restante > 0 && (
                    <p className="mt-2 text-amber-400 text-sm">
                      ⚠️ Restam apenas {uso.restante} gerações este mês
                    </p>
                  )}
                  {uso.restante === 0 && (
                    <p className="mt-2 text-red-400 text-sm">
                      ❌ Você atingiu o limite! Faça upgrade para continuar gerando.
                    </p>
                  )}
                </div>
              )}

              {erro && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {erro}
                </div>
              )}

              {/* Grid de Planos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {planos.map((plano) => {
                  const isAtual = planoAtual === plano.slug;
                  const recursos = typeof plano.recursos === 'string' ? JSON.parse(plano.recursos) : plano.recursos;

                  return (
                    <div
                      key={plano.id}
                      className={`relative rounded-xl p-5 border-2 transition-all ${
                        isAtual
                          ? 'border-amber-500 bg-amber-500/10'
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                      }`}
                    >
                      {isAtual && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
                          ATUAL
                        </div>
                      )}

                      {/* Ícone e Nome */}
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getCorPlano(plano.slug)} flex items-center justify-center text-white mb-4`}>
                        {getIconePlano(plano.slug)}
                      </div>

                      <h3 className="text-xl font-bold text-white mb-1">{plano.nome}</h3>
                      <p className="text-slate-400 text-sm mb-4">{plano.descricao}</p>

                      {/* Preço */}
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-white">
                          {plano.preco === 0 ? 'Grátis' : `R$ ${plano.preco}`}
                        </span>
                        {plano.preco > 0 && <span className="text-slate-400">/mês</span>}
                      </div>

                      {/* Recursos */}
                      <ul className="space-y-2 mb-6">
                        {recursos?.map((recurso, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                            <span className="text-slate-300">{recurso}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Botão */}
                      {isAtual ? (
                        plano.slug !== 'gratis' && assinatura?.status === 'ativa' ? (
                          <button
                            onClick={handleCancelar}
                            disabled={processando}
                            className="w-full py-2.5 bg-slate-600 hover:bg-red-600/80 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                          >
                            {processando ? 'Processando...' : 'Cancelar'}
                          </button>
                        ) : (
                          <button
                            disabled
                            className="w-full py-2.5 bg-slate-600 text-slate-400 rounded-lg font-medium cursor-not-allowed"
                          >
                            Plano Atual
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleAssinar(plano.slug)}
                          disabled={processando}
                          className={`w-full py-2.5 bg-gradient-to-r ${getCorPlano(plano.slug)} hover:opacity-90 text-white rounded-lg font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2`}
                        >
                          {processando ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CreditCard className="w-4 h-4" />
                          )}
                          {processando ? 'Processando...' : plano.preco === 0 ? 'Usar Grátis' : 'Assinar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info de pagamento */}
              <div className="mt-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600">
                <div className="flex items-center gap-3 text-slate-300 text-sm">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span>Pagamento seguro via Mercado Pago • PIX, Cartão ou Boleto</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ====================================
// MINI PREVIEW DE STORY (FIDELIDADE VISUAL)
// ====================================
function MiniStoryPreview({ template }) {
  const base = "w-14 h-24 rounded shadow-lg overflow-hidden flex flex-col relative shrink-0 border border-slate-700 bg-slate-900";

  if (template === 'voce-sabia') {
    return (
      <div className={base}>
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900 to-slate-950 opacity-50" />
        <div className="z-10 mt-3 text-[10px] text-center">⚖️</div>
        <div className="z-10 mt-1 h-2 bg-amber-500/30 mx-2 rounded-full" />
        <div className="z-10 mt-2 h-6 bg-white/5 mx-2 rounded border-l-2 border-amber-500" />
        <div className="z-10 mt-auto mb-2 h-3 bg-amber-500/80 mx-2 rounded-sm" />
      </div>
    );
  }

  if (template === 'bullets') {
    return (
      <div className={base}>
        <div className="absolute inset-0 bg-slate-900" />
        <div className="z-10 mt-2 ml-2 h-2 w-8 bg-amber-500/60 rounded-full" />
        <div className="z-10 mt-2 h-2 bg-white/40 mx-2 rounded-full" />
        <div className="z-10 mt-3 space-y-1.5 px-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-1 items-center">
              <div className="w-2 h-2 rounded-sm bg-amber-500/40" />
              <div className="flex-1 h-1 bg-white/20 rounded-full" />
            </div>
          ))}
        </div>
        <div className="z-10 mt-auto mb-2 h-4 bg-gradient-to-r from-amber-500 to-amber-600 mx-2 rounded-sm" />
      </div>
    );
  }

  if (template === 'estatistica') {
    return (
      <div className={base}>
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="z-10 mt-2 ml-2 h-1.5 w-6 bg-amber-500/40 rounded-full" />
        <div className="z-10 mt-3 flex flex-col items-center">
          <div className="text-[14px] font-bold text-amber-500 leading-none">80%</div>
          <div className="h-1 w-8 bg-zinc-700 rounded-full mt-1" />
        </div>
        <div className="z-10 mt-3 h-5 bg-white/5 mx-2 rounded" />
        <div className="z-10 mt-auto mb-2 px-2 flex justify-between items-center">
          <div className="w-3 h-3 rounded-full bg-amber-500/20" />
          <div className="w-4 h-1 bg-amber-500/40 rounded-full" />
        </div>
      </div>
    );
  }

  if (template === 'urgente') {
    return (
      <div className={base}>
        <div className="absolute inset-0 bg-stone-950" />
        <div className="z-10 mt-2 ml-2 h-3 w-10 bg-red-600 rounded-sm" />
        <div className="z-10 mt-2 h-2 bg-white/90 mx-2 rounded-full" />
        <div className="z-10 mt-2 h-8 border-2 border-red-600 mx-2 rounded-lg flex items-center justify-center">
          <div className="h-4 w-4 rounded-full bg-red-600/20" />
        </div>
        <div className="z-10 mt-auto mb-2 h-4 bg-red-600 mx-2 rounded-sm" />
      </div>
    );
  }

  if (template === 'premium') {
    return (
      <div className={base}>
        <div className="absolute inset-0 bg-slate-950" />
        <div className="z-10 mt-3 flex items-center gap-1 px-2">
          <div className="w-3 h-3 bg-amber-500/40 rounded-sm" />
          <div className="h-1 flex-1 bg-white/20 rounded-full" />
        </div>
        <div className="z-10 mt-2 mx-2 h-[1px] bg-amber-500/20" />
        <div className="z-10 mt-3 h-3 bg-white/40 mx-2 rounded-full" />
        <div className="z-10 mt-2 h-10 bg-amber-500/5 mx-2 border border-amber-500/20 rounded" />
        <div className="z-10 mt-auto mb-2 flex justify-end p-2">
          <div className="w-4 h-4 rounded-full bg-amber-500" />
        </div>
      </div>
    );
  }

  return <div className={base} />;
}

function PreviewRedeSocial({ tipo, formato = 'feed', conteudo, usuario, modoCompleto = false, imagemPreview = null, onPublicar = null, onVisualizarImagem = null, loadingImagem = false, tempoGeracao = 0, tentativaGeracao = 0, statusGeracao = '' }) {
  const [expandido, setExpandido] = useState(false);

  if (!conteudo) return null;

  // Separar texto e hashtags
  const separarHashtags = (texto) => {
    const linhas = texto.split('\n');
    const hashtags = [];
    const textoLimpo = [];

    linhas.forEach(linha => {
      if (linha.trim().startsWith('#') || (linha.includes('#') && linha.split('#').length > 3)) {
        hashtags.push(linha.trim());
      } else {
        textoLimpo.push(linha);
      }
    });

    return {
      texto: textoLimpo.join('\n').trim(),
      hashtags: hashtags.join(' ')
    };
  };

  // Extrair os primeiros 125 caracteres (o que aparece antes do "mais")
  const extrairGancho = (texto) => {
    const textoSemHashtags = texto.replace(/#\w+/g, '').trim();
    const primeirosCaracteres = textoSemHashtags.substring(0, 125);
    const temMais = textoSemHashtags.length > 125;
    return { gancho: primeirosCaracteres, temMais, total: textoSemHashtags.length };
  };

  const { texto, hashtags } = separarHashtags(conteudo);
  const { gancho, temMais, total } = extrairGancho(texto);

  // Preview Instagram Stories/Reels (vertical 9:16)
  const PreviewInstagramStories = () => {
    console.log('🖼️ [PREVIEW STORIES] Renderizando com imagemPreview:', imagemPreview ? 'POSSUI' : 'NULL');

    return (
      <div className="flex justify-center items-center w-full">
        <div className="bg-black rounded-2xl overflow-hidden w-[280px] shadow-2xl aspect-[9/16] relative border border-slate-800">
          {/* Camada 1: Fundo (Imagem ou Gradiente) */}
          <div className="absolute inset-0 z-0">
            {imagemPreview ? (
              <img
                src={imagemPreview}
                alt="Stories"
                className="w-full h-full object-cover"
                onLoad={() => console.log('✅ [IMG] Stories carregado!')}
              />
            ) : (
              <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                {loadingImagem ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto">
                      <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-amber-500 font-bold text-lg">Criando sua arte profissional...</p>
                      <p className="text-slate-400 text-sm italic">Isso leva cerca de 5 segundos</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 opacity-30">
                    <Instagram className="w-12 h-12 mx-auto text-white" />
                    <p className="text-white text-sm">Aguardando geração...</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camada 2: Header Instagram (Só aparece quando NÃO há imagem gerada) */}
          {!imagemPreview && (
            <div className="absolute top-0 left-0 right-0 p-4 z-20 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/40 to-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-fuchsia-600 p-[2px]">
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <span className="text-[10px] font-bold text-slate-700">{usuario?.nome?.[0] || 'A'}</span>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-[11px] font-bold leading-none">{usuario?.usuario || 'advogado'}</span>
                  <span className="text-white/70 text-[9px]">2h</span>
                </div>
              </div>
            </div>
          )}

          {/* Camada 3: Overlays de Interação (Sempre ocultos, pois é só um preview) */}
          <div className="absolute bottom-6 left-0 right-0 p-4 z-20 flex flex-col items-center pointer-events-none">
            <div className="flex flex-col items-center opacity-70">
              <ChevronUp className="w-4 h-4 text-white animate-bounce mb-[-4px]" />
              <div className="bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full text-white text-[10px] font-bold uppercase tracking-wider">
                Ver mais
              </div>
            </div>
          </div>

          {/* Badge superior lateral (Só aparece quando NÃO há imagem gerada) */}
          {!imagemPreview && (
            <div className="absolute top-12 right-4 z-20 pointer-events-none">
              <span className="bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white/80 font-medium">
                {formato === 'reels' ? 'Reels' : 'Story'}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Preview Instagram Feed (quadrado)
  const PreviewInstagram = () => (
    <div className="flex justify-center items-start w-full">
      <div className="bg-white rounded-xl overflow-hidden w-full max-w-[360px] shadow-2xl">
        {/* Header do Post */}
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 p-0.5">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
              <span className="text-xs font-bold text-gray-700">
                {usuario?.nome?.[0] || 'A'}
              </span>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{usuario?.nome?.toLowerCase().replace(/\s+/g, '') || 'advogado'}</p>
            <p className="text-xs text-gray-500">Patrocinado</p>
          </div>
          <svg className="w-5 h-5 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </div>

        {/* Imagem */}
        <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative group">
          {imagemPreview ? (
            <>
              <img
                src={imagemPreview}
                alt="Imagem do post"
                className="w-full h-full object-cover"
              />
              {onVisualizarImagem && (
                <button
                  onClick={onVisualizarImagem}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <div className="bg-white/90 rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <ZoomIn className="w-6 h-6 text-gray-700" />
                  </div>
                </button>
              )}
            </>
          ) : (
            <div className="text-center p-6">
              <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sua imagem aqui</p>
              <p className="text-xs text-slate-400 mt-1">Clique em "Imagem"</p>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>

          <p className="text-sm font-semibold text-gray-900 mb-1">1.234 curtidas</p>

          {/* Texto do Post - Mostra apenas 125 caracteres (limite real do Instagram) */}
          <div className="text-sm text-gray-900">
            <span className="font-semibold">{usuario?.nome?.toLowerCase().replace(/\s+/g, '') || 'advogado'} </span>
            {expandido ? (
              <>
                <span className="whitespace-pre-line">{texto}</span>
                {hashtags && <span className="text-blue-900 block mt-2">{hashtags}</span>}
                <button
                  onClick={() => setExpandido(false)}
                  className="text-gray-400 block mt-1"
                >
                  ...menos
                </button>
              </>
            ) : (
              <>
                <span className="whitespace-pre-line">{gancho}</span>
                {temMais && (
                  <span
                    className="text-gray-400 ml-1 cursor-pointer hover:text-gray-600"
                    onClick={() => setExpandido(true)}
                  >
                    ... <span className="underline">mais</span>
                  </span>
                )}
              </>
            )}
          </div>

          {/* Indicador de caracteres do gancho */}
          {!expandido && (
            <div className={`mt-2 text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${gancho.length <= 125 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              <span className="font-medium">Gancho:</span> {gancho.length}/125 caracteres
              {gancho.length <= 125 ? ' ✓' : ' (ideal: até 125)'}
            </div>
          )}

          {/* Hashtags quando não expandido */}
          {!expandido && hashtags && (
            <p className="text-sm text-blue-900 mt-2 line-clamp-1">{hashtags}</p>
          )}

          <p className="text-xs text-gray-400 mt-2 uppercase">Há 2 horas</p>
        </div>
      </div>
    </div>
  );

  // Preview Facebook
  const PreviewFacebook = () => (
    <div className="flex justify-center items-start w-full">
      <div className="bg-white rounded-xl overflow-hidden w-full max-w-[400px] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <span className="text-sm font-bold text-white">
              {usuario?.nome?.[0] || 'A'}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{usuario?.nome || 'Advogado'}</p>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>2 h</span>
              <span>·</span>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
            </div>
          </div>
          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="18" r="2" />
          </svg>
        </div>

        {/* Texto do Post */}
        <div className="px-3 pb-3">
          <p className="text-sm text-gray-900 whitespace-pre-line">{texto}</p>
          {hashtags && (
            <p className="text-sm text-blue-600 mt-2">{hashtags}</p>
          )}
        </div>

        {/* Imagem */}
        <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center overflow-hidden relative group">
          {imagemPreview ? (
            <>
              <img
                src={imagemPreview}
                alt="Imagem do post"
                className="w-full h-full object-cover"
              />
              {onVisualizarImagem && (
                <button
                  onClick={onVisualizarImagem}
                  className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  <div className="bg-white/90 rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <ZoomIn className="w-6 h-6 text-gray-700" />
                  </div>
                </button>
              )}
            </>
          ) : (
            <div className="text-center p-6">
              <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sua imagem aqui</p>
            </div>
          )}
        </div>

        {/* Reações */}
        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                <span className="text-sm">👍</span>
                <span className="text-sm">❤️</span>
                <span className="text-sm">😮</span>
              </div>
              <span className="text-sm text-gray-500 ml-1">256</span>
            </div>
            <div className="text-sm text-gray-500">
              <span>42 comentários</span>
              <span className="mx-1">·</span>
              <span>18 compartilhamentos</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-gray-100">
            <button className="flex items-center justify-center gap-2 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span className="text-sm font-medium">Curtir</span>
            </button>
            <button className="flex items-center justify-center gap-2 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="text-sm font-medium">Comentar</span>
            </button>
            <button className="flex items-center justify-center gap-2 py-2 text-gray-600 hover:bg-gray-50 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span className="text-sm font-medium">Enviar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Preview TikTok
  const PreviewTikTok = () => {
    // Extrair roteiro e legenda do TikTok
    const extrairLegendaTikTok = (texto) => {
      const legendaMatch = texto.match(/LEGENDA[:\s]*([\s\S]*?)(?:---|$)/i);
      if (legendaMatch) return legendaMatch[1].trim();

      // Se não tiver formato de roteiro, pegar últimas linhas
      const linhas = texto.split('\n').filter(l => l.trim());
      return linhas.slice(-3).join(' ').substring(0, 150);
    };

    const legenda = extrairLegendaTikTok(conteudo);

    return (
      <div className="flex justify-center items-center w-full">
        <div className="bg-black rounded-2xl overflow-hidden w-[280px] shadow-2xl aspect-[9/16] relative">
          {/* Área do vídeo */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-black flex items-center justify-center group">
            {imagemPreview ? (
              <>
                <img
                  src={imagemPreview}
                  alt="Thumbnail do vídeo"
                  className="w-full h-full object-cover"
                />
                {onVisualizarImagem && (
                  <button
                    onClick={onVisualizarImagem}
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                  >
                    <div className="bg-white/90 rounded-full p-3 shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <ZoomIn className="w-6 h-6 text-gray-700" />
                    </div>
                  </button>
                )}
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <p className="text-white/60 text-xs">Seu vídeo aqui</p>
              </div>
            )}
          </div>

          {/* Overlay gradient - Somente se não houver imagem real ou se quiser escurecer o fundo, mas a imagem do Puppeteer já é completa */}
          {!imagemPreview && <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />}

          {/* Ícones laterais */}
          <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
            {/* Perfil */}
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center border-2 border-white">
                <span className="text-sm font-bold text-white">{usuario?.nome?.[0] || 'A'}</span>
              </div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white text-xs font-bold">+</span>
              </div>
            </div>

            {/* Curtir */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <span className="text-white text-xs font-medium">45.2K</span>
            </div>

            {/* Comentários */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z" />
                </svg>
              </div>
              <span className="text-white text-xs font-medium">892</span>
            </div>

            {/* Salvar */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z" />
                </svg>
              </div>
              <span className="text-white text-xs font-medium">12.3K</span>
            </div>

            {/* Compartilhar */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z" />
                </svg>
              </div>
              <span className="text-white text-xs font-medium">3.1K</span>
            </div>

            {/* Disco de música */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 flex items-center justify-center animate-spin" style={{ animationDuration: '3s' }}>
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-600" />
            </div>
          </div>

          {/* Informações do post - Ocultar se já houver imagem real, pois a imagem do Puppeteer já contém o texto */}
          {!imagemPreview && (
            <div className="absolute bottom-4 left-3 right-16">
              <p className="text-white font-semibold text-sm mb-1">@{usuario?.nome?.toLowerCase().replace(/\s+/g, '_') || 'advogado'}</p>
              <p className="text-white text-xs leading-relaxed line-clamp-3">{legenda}</p>

              {/* Música */}
              <div className="flex items-center gap-2 mt-2">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                <p className="text-white text-xs">Som original - {usuario?.nome || 'Advogado'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Renderizar preview baseado no tipo e formato
  const renderPreview = () => {
    switch (tipo) {
      case 'post-instagram':
        if (formato === 'stories' || formato === 'reels') {
          return <PreviewInstagramStories />;
        }
        return <PreviewInstagram />;
      case 'post-facebook':
        if (formato === 'stories') {
          return <PreviewFacebookStories />;
        }
        return <PreviewFacebook />;
      case 'post-tiktok':
        return <PreviewTikTok />;
      default:
        return null;
    }
  };

  // Preview Facebook Stories
  const PreviewFacebookStories = () => (
    <div className="flex justify-center items-center w-full">
      <div className="bg-black rounded-2xl overflow-hidden w-[280px] shadow-2xl aspect-[9/16] relative">
        {/* Imagem de fundo fullscreen */}
        <div className="absolute inset-0">
          {imagemPreview ? (
            <>
              <img
                src={imagemPreview}
                alt="Stories"
                className="w-full h-full object-cover"
              />
              {onVisualizarImagem && (
                <button
                  onClick={onVisualizarImagem}
                  className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-all cursor-pointer z-10"
                >
                  <div className="bg-white/90 rounded-full p-3 shadow-lg">
                    <ZoomIn className="w-6 h-6 text-gray-700" />
                  </div>
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
              {loadingImagem ? (
                <div className="space-y-4 animate-pulse">
                  <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-blue-500 font-bold text-lg">Criando sua arte profissional...</p>
                    <p className="text-slate-400 text-sm italic">Isso leva cerca de 5 segundos</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 opacity-30">
                  <ImageIcon className="w-12 h-12 mx-auto text-white/50" />
                  <p className="text-white/50 text-sm">Aguardando geração...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Header Stories */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/50 to-transparent z-20">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center border-2 border-blue-400">
              <span className="text-sm font-bold text-white">{usuario?.nome?.[0] || 'A'}</span>
            </div>
            <div>
              <span className="text-white text-sm font-medium block">{usuario?.nome || 'Advogado'}</span>
              <span className="text-white/60 text-xs">2h atrás</span>
            </div>
          </div>
        </div>

        {/* Texto na parte inferior - Ocultar se já houver imagem real */}
        {!imagemPreview && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20">
            <p className="text-white text-sm leading-relaxed line-clamp-4">
              {gancho}{temMais && '...'}
            </p>
          </div>
        )}

        {/* Indicador Stories */}
        <div className="absolute top-14 left-0 right-0 flex justify-center z-20">
          <span className="bg-blue-500/80 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-medium">
            📱 Stories
          </span>
        </div>
      </div>
    </div>
  );

  // Preview genérico para tipos sem visualização específica (LinkedIn, Blog, Thread)
  const PreviewGenerico = () => {
    const linhas = conteudo.split('\n');
    const primeiraLinha = linhas[0];
    const resto = linhas.slice(1).join('\n');
    const hashtagsTexto = resto.match(/#\w+/g)?.join(' ') || '';
    const textoSemHashtags = resto.replace(/#\w+/g, '').trim();

    return (
      <div className="bg-white rounded-xl p-6 max-w-[500px] mx-auto shadow-xl">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{usuario?.nome?.[0] || 'A'}</span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{usuario?.nome || 'Advogado'}</p>
            <p className="text-sm text-gray-500">
              {tipo === 'post-linkedin' ? 'LinkedIn' :
                tipo === 'artigo' ? 'Blog/Artigo' :
                  tipo === 'thread' ? 'Thread X' : 'Post'}
            </p>
          </div>
        </div>

        <div className="text-gray-800">
          <p className="font-semibold text-lg mb-3">{primeiraLinha}</p>
          <p className="whitespace-pre-line leading-relaxed text-gray-600">{textoSemHashtags}</p>
        </div>

        {hashtagsTexto && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-blue-600 text-sm">{hashtagsTexto}</p>
          </div>
        )}
      </div>
    );
  };

  // MODO COMPLETO - Renderiza direto como preview principal
  if (modoCompleto) {
    // Para tipos com preview específico
    if (['post-instagram', 'post-facebook', 'post-tiktok'].includes(tipo)) {
      return (
        <div className="flex flex-col items-center relative">
          {renderPreview()}
          {loadingImagem && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 rounded-xl">
              <div className="bg-slate-800/95 px-6 py-4 rounded-xl shadow-lg flex flex-col items-center gap-2 border border-slate-600">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-sm font-medium text-white">{statusGeracao || 'Criando imagem...'}</span>
                {tempoGeracao > 0 && (
                  <span className="text-xs text-slate-400">{tempoGeracao}s{tentativaGeracao > 1 ? ` • Tentativa ${tentativaGeracao}` : ''}</span>
                )}
                {tempoGeracao > 15 && (
                  <span className="text-xs text-amber-400/80">A imagem IA pode demorar até 90s</span>
                )}
              </div>
            </div>
          )}
          <p className="text-xs text-slate-500 text-center mt-4">
            * Simulação de como ficará o post. Clique em "mais" para expandir.
          </p>
        </div>
      );
    }
    // Para tipos sem preview específico
    return (
      <div className="flex flex-col items-center">
        <PreviewGenerico />
        <p className="text-xs text-slate-500 text-center mt-4">
          * Preview do conteúdo formatado.
        </p>
      </div>
    );
  }

  // MODO TOGGLE (antigo) - não usado mais, mas mantido para compatibilidade
  if (!['post-instagram', 'post-facebook', 'post-tiktok'].includes(tipo)) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700">
        <div className="text-center mb-4">
          <span className="text-xs text-slate-400 uppercase tracking-wider">
            Pré-visualização - {tipo === 'post-instagram' ? 'Instagram' : tipo === 'post-facebook' ? 'Facebook' : 'TikTok'}
          </span>
        </div>
        {renderPreview()}
        {loadingImagem && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 rounded-xl pointer-events-none">
            <div className="bg-white/90 px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
              <span className="text-sm font-medium text-slate-700">Criando imagem...</span>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500 text-center mt-4">
          * Esta é uma simulação. O visual real pode variar.
        </p>
      </div>
    </div>
  );
}

// ====================================
// COMPONENTE DE TRENDING TOPICS
// ====================================
function TrendingTopicsComponent({ onSelectTema, areaAtuacao }) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataAtualizacao, setDataAtualizacao] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(10);
  const [fonte, setFonte] = useState(null);

  const carregarTrending = async () => {
    try {
      // Buscar direto do webhook do n8n
      const response = await fetch('https://blasterskd.com.br/api/n8n/webhook/trending-juridico-manual');
      if (response.ok) {
        const data = await response.json();
        setTrending(data.trending || []);
        setDataAtualizacao(data.dataAtualizacao);
        setFonte(data.fonte || null);
        // Salvar em cache local
        localStorage.setItem('trending-juridico-cache', JSON.stringify({
          trending: data.trending,
          dataAtualizacao: data.dataAtualizacao,
          fonte: data.fonte,
          cachedAt: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.log('Erro ao carregar trending:', error);
      // Tentar carregar do cache
      const cache = localStorage.getItem('trending-juridico-cache');
      if (cache) {
        const dados = JSON.parse(cache);
        setTrending(dados.trending || []);
        setDataAtualizacao(dados.dataAtualizacao);
        setFonte(dados.fonte || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const forcarAtualizacao = async () => {
    setAtualizando(true);
    try {
      // Chamar direto o webhook do n8n
      const response = await fetch('https://blasterskd.com.br/api/n8n/webhook/trending-juridico-manual');
      if (response.ok) {
        const data = await response.json();
        setTrending(data.trending || []);
        setDataAtualizacao(data.dataAtualizacao);
        setFonte(data.fonte || null);
        // Atualizar cache
        localStorage.setItem('trending-juridico-cache', JSON.stringify({
          trending: data.trending,
          dataAtualizacao: data.dataAtualizacao,
          fonte: data.fonte,
          cachedAt: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.log('Erro ao atualizar:', error);
    } finally {
      setAtualizando(false);
    }
  };

  useEffect(() => {
    carregarTrending();
  }, []);

  // Timer countdown enquanto carrega
  useEffect(() => {
    if (loading && tempoRestante > 0) {
      const timer = setTimeout(() => setTempoRestante(tempoRestante - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, tempoRestante]);

  const formatarData = (dataISO) => {
    if (!dataISO) return '';
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-yellow-500/10 backdrop-blur rounded-xl p-4 border border-amber-500/30 mb-6">
        <div className="flex items-center justify-center gap-4">
          <div className="relative">
            <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
            <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-md animate-pulse" />
          </div>
          <div className="text-center">
            <span className="text-slate-300 text-sm block">Buscando temas em alta...</span>
            <div className="flex items-center justify-center gap-2 mt-1">
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
                  style={{ width: `${(10 - tempoRestante) * 10}%` }}
                />
              </div>
              <span className="text-xs text-amber-400 font-mono">{tempoRestante}s</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-xl border border-amber-500/40 mb-6 shadow-lg shadow-amber-500/5">
      {/* Header compacto */}
      <div
        className="relative flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-1.5 rounded-lg">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            Temas em Alta
            <Sparkles className="w-3 h-3 text-amber-400" />
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              forcarAtualizacao();
            }}
            disabled={atualizando}
            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 rounded-lg transition-all disabled:opacity-50"
            title="Atualizar temas"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${atualizando ? 'animate-spin' : ''}`} />
          </button>
          <div className={`transform transition-transform duration-300 ${expandido ? 'rotate-180' : ''}`}>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Conteúdo expandível - Layout Horizontal */}
      <div className={`transition-all duration-400 ease-out overflow-hidden ${expandido ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {trending.map((item, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden bg-slate-900/50 hover:bg-slate-800/80 border border-slate-700/50 hover:border-amber-500/50 rounded-lg p-3 text-left transition-all duration-300 hover:shadow-md hover:shadow-amber-500/10"
              >
                {/* Badge de posição */}
                <span className={`absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${idx === 0 ? 'bg-amber-500/20 text-amber-400' :
                  idx === 1 ? 'bg-slate-500/20 text-slate-300' :
                    'bg-orange-500/20 text-orange-400'
                  }`}>
                  #{idx + 1}
                </span>

                {/* Ícone e Conteúdo */}
                <div className="text-xl mb-1.5 group-hover:scale-110 transition-transform duration-300">
                  {item.icone || '📌'}
                </div>

                <h4 className="font-medium text-xs text-white group-hover:text-amber-400 transition-colors line-clamp-2 leading-tight mb-1 pr-6">
                  {item.tema}
                </h4>

                {/* Descrição/Justificativa */}
                {item.descricao && (
                  <p className="text-[9px] text-slate-400 line-clamp-2 mb-1.5 leading-relaxed">
                    {item.descricao}
                  </p>
                )}

                <div className="flex items-center gap-1 flex-wrap mb-2">
                  <span className="text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded-full">
                    {item.area}
                  </span>
                  {item.data && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {item.data}
                    </span>
                  )}
                </div>

                {/* Botões de ação */}
                <div className="flex items-center gap-1 pt-2 border-t border-slate-700/30">
                  <button
                    onClick={() => onSelectTema(item.tema, item.area)}
                    className="flex-1 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-2 py-1 rounded transition-colors"
                  >
                    Usar tema
                  </button>
                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white rounded transition-colors"
                      title="Ver notícia original"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Efeito de hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            ))}
          </div>

          {/* Link da fonte */}
          {fonte && (
            <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">
                Fonte: {fonte.nome}
              </span>
              <a
                href={fonte.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-400 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Ver notícias
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ====================================
// COMPONENTE DE PALETA DE CORES (SIMPLIFICADO)
// ====================================
function SeletorPaletaCores() {
  const [paletaSelecionada, setPaletaSelecionada] = useState(null);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  // Paletas pré-definidas para advogados
  const PALETAS_PROFISSIONAIS = [
    {
      id: 'classico',
      nome: 'Clássico',
      desc: 'Tradicional e confiável',
      cores: ['#1e3a5f', '#d4af37', '#0d1b2a']
    },
    {
      id: 'moderno',
      nome: 'Moderno',
      desc: 'Clean e atual',
      cores: ['#2d3748', '#4299e1', '#1a202c']
    },
    {
      id: 'executivo',
      nome: 'Executivo',
      desc: 'Elegante e sofisticado',
      cores: ['#1a1a2e', '#c9a050', '#16213e']
    },
    {
      id: 'minimalista',
      nome: 'Minimalista',
      desc: 'Simples e direto',
      cores: ['#374151', '#9ca3af', '#f59e0b']
    },
    {
      id: 'corporativo',
      nome: 'Corporativo',
      desc: 'Profissional e sério',
      cores: ['#1e40af', '#fbbf24', '#1e3a8a']
    },
    {
      id: 'verde',
      nome: 'Verde Advocacia',
      desc: 'Natureza e equilíbrio',
      cores: ['#065f46', '#d4af37', '#064e3b']
    }
  ];

  const { perfil, atualizarPerfil } = useAuth();

  const selecionarPaleta = async (paleta) => {
    setPaletaSelecionada(paleta);
    // Salvar no banco (persistente entre navegadores)
    try {
      await atualizarPerfil({ paleta_cores: paleta });
    } catch (e) {
      console.log('Erro ao salvar paleta no perfil');
    }
    // Cache local + evento para sincronizar CriadorCompleto
    try { localStorage.setItem('paleta-cores-advogado', JSON.stringify(paleta)); } catch (e) {}
    window.dispatchEvent(new Event("paletaCoresAtualizada"));
  };

  useEffect(() => {
    // Carregar paleta: prioridade banco > localStorage
    if (perfil?.paleta_cores) {
      setPaletaSelecionada(perfil.paleta_cores);
      try { localStorage.setItem('paleta-cores-advogado', JSON.stringify(perfil.paleta_cores)); } catch (e) {}
    } else {
      try {
        const local = localStorage.getItem('paleta-cores-advogado');
        if (local) {
          const parsed = JSON.parse(local);
          setPaletaSelecionada(parsed);
          // Migrar localStorage para o banco
          atualizarPerfil({ paleta_cores: parsed }).catch(() => {});
        }
      } catch (e) {}
    }
  }, [perfil?.paleta_cores]);

  const removerPaleta = async () => {
    if (confirm('Remover paleta de cores?')) {
      setPaletaSelecionada(null);
      try { localStorage.removeItem('paleta-cores-advogado'); } catch (e) {}
      try { await atualizarPerfil({ paleta_cores: null }); } catch (e) {}
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Palette className="w-5 h-5 text-amber-400" />
          Paleta de Cores
        </h3>
        <button
          onClick={() => setMostrarConfig(!mostrarConfig)}
          className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          {mostrarConfig ? 'Ocultar' : 'Escolher'}
        </button>
      </div>

      {mostrarConfig && (
        <div className="space-y-4">
          {/* Paletas Pré-definidas */}
          <div className="mb-4">
            <p className="text-sm text-slate-300 mb-3">Escolha uma paleta profissional:</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PALETAS_PROFISSIONAIS.map((paleta) => (
                <button
                  key={paleta.id}
                  onClick={() => selecionarPaleta(paleta)}
                  className={`p-3 rounded-lg border transition-all text-left ${paletaSelecionada?.id === paleta.id
                    ? 'border-amber-400 bg-amber-400/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                    }`}
                >
                  <div className="flex gap-1 mb-2">
                    {paleta.cores.map((cor, idx) => (
                      <div
                        key={idx}
                        className="w-5 h-5 rounded-full border border-slate-500"
                        style={{ backgroundColor: cor }}
                      />
                    ))}
                  </div>
                  <div className={`text-sm font-medium ${paletaSelecionada?.id === paleta.id ? 'text-amber-400' : 'text-white'}`}>
                    {paleta.nome}
                  </div>
                  <div className="text-xs text-slate-400">{paleta.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {paletaSelecionada && (
            <div className="bg-slate-900/50 rounded-lg p-4 border border-amber-500/30">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-semibold text-green-400">Paleta selecionada!</span>
                </div>
                <button onClick={removerPaleta} className="text-slate-400 hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-400">Cores:</span>
                  <div className="flex gap-2 mt-2">
                    {paletaSelecionada.cores?.map((cor, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <div className="w-14 h-14 rounded-lg border-2 border-slate-600" style={{ backgroundColor: cor }} />
                        <span className="text-xs text-slate-500">{cor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <p className="text-xs text-amber-400">
                  ✨ Suas imagens usarão as cores da sua paleta!
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!mostrarConfig && paletaSelecionada && (
        <div className="flex items-center gap-3">
          <Check className="w-4 h-4 text-green-400" />
          <div className="flex gap-1.5">
            {paletaSelecionada.cores?.slice(0, 3).map((cor, idx) => (
              <div key={idx} className="w-7 h-7 rounded border-2 border-slate-600" style={{ backgroundColor: cor }} />
            ))}
          </div>
          <span className="text-sm text-slate-300">{paletaSelecionada.nome}</span>
        </div>
      )}
    </div>
  );
}


// ====================================
// COMPONENTE DE CONFIGURAÇÕES DE LOGO
// ====================================
function ConfiguracoesLogo({ user, onSaveLogo, onClose }) {
  const [logo, setLogo] = useState(user.logo || null);
  const [previewLogo, setPreviewLogo] = useState(user.logo || null);
  const [salvando, setSalvando] = useState(false);

  const handleUploadLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('❌ Apenas imagens são permitidas');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('❌ Imagem muito grande! Máximo 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      setPreviewLogo(base64);
      setLogo(base64);
    };
    reader.readAsDataURL(file);
  };

  const removerLogo = () => {
    setLogo(null);
    setPreviewLogo(null);
  };

  const salvarLogo = () => {
    setSalvando(true);
    setTimeout(() => {
      const userData = localStorage.getItem(`user:${user.usuario}`);
      if (userData) {
        const userObj = JSON.parse(userData);
        userObj.logo = logo;
        localStorage.setItem(`user:${user.usuario}`, JSON.stringify(userObj));

        const sessao = JSON.parse(localStorage.getItem('sessao-ativa'));
        sessao.logo = logo;
        localStorage.setItem('sessao-ativa', JSON.stringify(sessao));

        onSaveLogo(logo);
      }
      setSalvando(false);
      alert('✅ Logo salva com sucesso!');
      onClose();
    }, 500);
  };

  return (
    <div className="space-y-4">
      {previewLogo ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img
              src={previewLogo}
              alt="Logo"
              className="w-32 h-32 object-contain rounded-lg bg-white p-2"
            />
            <button
              onClick={removerLogo}
              className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-slate-400 text-sm">Logo atual</p>
        </div>
      ) : (
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">Nenhuma logo configurada</p>
          <p className="text-slate-500 text-sm">Faça upload abaixo</p>
        </div>
      )}

      <div>
        <label className="block w-full">
          <input
            type="file"
            accept="image/*"
            onChange={handleUploadLogo}
            className="hidden"
          />
          <div className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-4 py-3 text-white text-center cursor-pointer transition-all flex items-center justify-center gap-2">
            <Upload className="w-5 h-5" />
            {previewLogo ? 'Trocar Logo' : 'Fazer Upload'}
          </div>
        </label>
        <p className="text-slate-500 text-xs mt-2">
          Formatos: PNG, JPG, SVG • Tamanho máximo: 2MB • Recomendado: fundo transparente
        </p>
      </div>

      {logo && (
        <button
          onClick={salvarLogo}
          disabled={salvando}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          {salvando ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Salvar Logo
            </>
          )}
        </button>
      )}

      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
        <p className="text-amber-400 text-sm font-medium mb-1">💡 Dica:</p>
        <p className="text-slate-300 text-xs">
          Sua logo será adicionada automaticamente em todas as imagens geradas.
          Use logo com fundo transparente (PNG) para melhor resultado.
        </p>
      </div>
    </div>
  );
}

// ====================================
// COMPONENTE DE LOGIN
// ====================================
function CriadorCompleto({ user, onLogout, onAbrirGaleria, onAbrirPerfil, onAbrirPlanos, onSalvarImagem }) {
  const { fetchAuth, perfil } = useAuth();
  // DADOS ESTÁTICOS
  const DADOS = {
    tiposConteudo: [
      {
        id: 'post-instagram',
        nome: 'Instagram',
        icon: 'instagram',
        principal: true,
        formatos: [
          { id: 'feed', nome: 'Feed', desc: 'Post quadrado 1:1', aspectRatio: '1:1', previewClass: 'aspect-square' },
          { id: 'stories', nome: 'Stories', desc: 'Vertical 9:16', aspectRatio: '9:16', previewClass: 'aspect-[9/16]' },
          { id: 'reels', nome: 'Reels', desc: 'Vertical 9:16', aspectRatio: '9:16', previewClass: 'aspect-[9/16]' }
        ]
      },
      {
        id: 'post-facebook',
        nome: 'Facebook',
        icon: 'facebook',
        principal: true,
        formatos: [
          { id: 'feed', nome: 'Feed', desc: 'Post horizontal 16:9', aspectRatio: '16:9', previewClass: 'aspect-video' },
          { id: 'stories', nome: 'Stories', desc: 'Vertical 9:16', aspectRatio: '9:16', previewClass: 'aspect-[9/16]' }
        ]
      },
      {
        id: 'post-tiktok',
        nome: 'TikTok',
        icon: 'tiktok',
        principal: true,
        formatos: [
          { id: 'video', nome: 'Vídeo', desc: 'Vertical 9:16', aspectRatio: '9:16', previewClass: 'aspect-[9/16]' }
        ]
      },
      {
        id: 'post-linkedin',
        nome: 'LinkedIn',
        icon: 'linkedin',
        principal: false,
        formatos: [
          { id: 'feed', nome: 'Post', desc: 'Feed padrão', aspectRatio: '1:1', previewClass: 'aspect-square' }
        ]
      },
      { id: 'artigo', nome: 'Artigo Blog', icon: 'blog', principal: false, formatos: [] },
      { id: 'thread', nome: 'Thread X', icon: 'twitter', principal: false, formatos: [] }
    ],
    areasAtuacao: [
      'Direito Civil', 'Direito Penal', 'Direito Trabalhista',
      'Direito Empresarial', 'Direito do Consumidor', 'Direito de Família',
      'Direito Tributário', 'Direito Imobiliário', 'Direito Previdenciário', 'Direito Digital'
    ],
    tons: [
      { id: 'profissional', nome: 'Profissional' },
      { id: 'didatico', nome: 'Didático' },
      { id: 'acessivel', nome: 'Acessível' },
      { id: 'inspirador', nome: 'Inspirador' }
    ],
    tamanhos: [
      { id: 'curto', nome: 'Curto', desc: '~100 palavras' },
      { id: 'medio', nome: 'Médio', desc: '~250 palavras' },
      { id: 'longo', nome: 'Longo', desc: '~500 palavras' }
    ],
    sugestoesAssuntos: {
      'Direito Civil': ['Como funciona a usucapião', 'Direitos do inquilino', 'Responsabilidade civil', 'Contratos de compra e venda', 'Prescrição de dívidas'],
      'Direito Penal': ['Flagrante vs prisão preventiva', 'Direitos do preso', 'Legítima defesa', 'Crimes contra a honra', 'Acordo de não persecução'],
      'Direito Trabalhista': ['Rescisão indireta', 'Horas extras', 'Assédio moral', 'Acordo trabalhista', 'Home office'],
      'Direito Empresarial': ['MEI vs ME vs EPP', 'Proteger marca', 'Sociedade entre sócios', 'Recuperação judicial', 'Due diligence'],
      'Direito do Consumidor': ['Produto com defeito', 'Cancelar compras online', 'Nome negativado', 'Cobrança abusiva', 'Voo atrasado'],
      'Direito de Família': ['Divórcio consensual', 'Pensão alimentícia', 'Guarda compartilhada', 'Reconhecimento de paternidade', 'União estável'],
      'Direito Tributário': ['Contestar auto de infração', 'Malha fina', 'Parcelamento', 'ISS, ICMS, IPI', 'Planejamento tributário'],
      'Direito Imobiliário': ['Documentos para comprar imóvel', 'Distrato', 'Problemas com construtora', 'ITBI', 'Condomínio'],
      'Direito Previdenciário': ['Aposentadoria', 'INSS negou benefício', 'Revisão da vida toda', 'BPC-LOAS', 'Auxílio-doença'],
      'Direito Digital': ['LGPD', 'Vazamento de dados', 'Crimes virtuais', 'Contratos digitais', 'Direito ao esquecimento']
    },
    sugestoesPublico: [
      'Empresários', 'Profissionais liberais', 'Trabalhadores CLT', 'Consumidores',
      'Pessoas físicas', 'MEI', 'Gestores RH', 'Síndicos', 'Aposentados',
      'Jovens profissionais', 'Proprietários', 'Locadores', 'Pais', 'Vítimas de acidentes'
    ],
    formatosImagem: [
      {
        id: 'quadrado',
        nome: 'Quadrado',
        desc: 'Feed Instagram/LinkedIn',
        dimensoes: { width: 1080, height: 1080 },
        icon: '⬜'
      },
      {
        id: 'stories',
        nome: 'Stories',
        desc: 'Instagram/Facebook Stories',
        dimensoes: { width: 1080, height: 1920 },
        icon: '📱'
      },
      {
        id: 'landscape',
        nome: 'Paisagem',
        desc: 'YouTube/LinkedIn',
        dimensoes: { width: 1920, height: 1080 },
        icon: '🖥️'
      }
    ],
    templatesStory: [
      { id: 'voce-sabia', nome: 'Você Sabia?', desc: 'Perguntas e curiosidades', icon: '❓' },
      { id: 'estatistica', nome: 'Estatística', desc: 'Dados e números impactantes', icon: '📊' },
      { id: 'urgente', nome: 'Urgente/Alerta', desc: 'Prazos e avisos importantes', icon: '🚨' },
    ],
    estilosImagem: [
      {
        id: 'classico',
        nome: 'Escritório Clássico',
        desc: 'Tradicional com livros e madeira',
        icone: '📚',
        cores: 'Marrom e dourado'
      },
      {
        id: 'moderno',
        nome: 'Escritório Moderno',
        desc: 'Clean e minimalista',
        icone: '💼',
        cores: 'Branco e preto'
      },
      {
        id: 'executivo',
        nome: 'Escritório Executivo',
        desc: 'Luxuoso e sofisticado',
        icone: '🏛️',
        cores: 'Mogno e couro'
      },
      {
        id: 'acolhedor',
        nome: 'Ambiente Acolhedor',
        desc: 'Humanizado e próximo',
        icone: '🤝',
        cores: 'Tons quentes'
      }
    ]
  };

  // ESTADOS
  const [tipoConteudo, setTipoConteudo] = useState('');
  const [formatoPost, setFormatoPost] = useState(''); // feed, stories, reels, video
  const [areaAtuacao, setAreaAtuacao] = useState('');
  const [tema, setTema] = useState('');
  const [publicoAlvo, setPublicoAlvo] = useState('');
  const [tom, setTom] = useState('profissional');
  const [tamanho, setTamanho] = useState('medio');
  const [conteudoGerado, setConteudoGerado] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [mostrarMenuAcoes, setMostrarMenuAcoes] = useState(false);
  const [imagemPreview, setImagemPreview] = useState(null);
  const imagemPreviewRef = useRef(null); // Ref para persistir a URL da imagem
  const [mostrarImagemFull, setMostrarImagemFull] = useState(false);
  const [mostrarDicasAssunto, setMostrarDicasAssunto] = useState(false);
  const [mostrarDicasPublico, setMostrarDicasPublico] = useState(false);

  // Estados para imagens
  const [mostrarModalImagem, setMostrarModalImagem] = useState(false);
  const [estiloImagem, setEstiloImagem] = useState('classico');
  const [templateStory, setTemplateStory] = useState('voce-sabia');
  const [imagemGerada, setImagemGerada] = useState(null);
  const [conteudoStoryEditavel, setConteudoStoryEditavel] = useState(null);
  const [tipoImagemStory, setTipoImagemStory] = useState('stock');
  const [mostrarEditorConteudo, setMostrarEditorConteudo] = useState(false);
  const [loadingConteudo, setLoadingConteudo] = useState(false);

  const [loadingImagem, setLoadingImagem] = useState(false);
  const [tempoGeracao, setTempoGeracao] = useState(0);
  const [tentativaGeracao, setTentativaGeracao] = useState(0);
  const [statusGeracao, setStatusGeracao] = useState('');
  const timerGeracaoRef = useRef(null);
  const [modoImagem, setModoImagem] = useState(null); // 'upload' ou 'gerar' ou null
  const [imagemUpload, setImagemUpload] = useState(null);
  const [imagemCarregada, setImagemCarregada] = useState(false);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [paletaCores, setPaletaCores] = useState(null);

  // Derivar formatoImagem do formatoPost selecionado
  const formatoImagem = (() => {
    if (formatoPost === 'stories' || formatoPost === 'reels' || formatoPost === 'video') {
      return 'stories'; // 9:16
    } else if (tipoConteudo === 'post-facebook' && formatoPost === 'feed') {
      return 'landscape'; // 16:9
    }
    return 'quadrado'; // 1:1
  })();

  const aplicarPaleta = (paletaParsed) => {
    setPaletaCores(paletaParsed);
    if (paletaParsed?.nome) {
      const estiloMap = {
        'classico': 'classico', 'clássico': 'classico',
        'moderno': 'moderno', 'contemporâneo': 'moderno', 'contemporaneo': 'moderno',
        'executivo': 'executivo', 'corporativo': 'executivo', 'profissional': 'executivo',
        'acolhedor': 'acolhedor', 'humanizado': 'acolhedor', 'minimalista': 'moderno'
      };
      setEstiloImagem(estiloMap[paletaParsed.nome.toLowerCase()] || 'classico');
    }
  };

  useEffect(() => {
    // Carregar paleta: prioridade banco > localStorage
    if (perfil?.paleta_cores) {
      aplicarPaleta(perfil.paleta_cores);
    } else {
      try {
        const local = localStorage.getItem("paleta-cores-advogado");
        if (local) aplicarPaleta(JSON.parse(local));
      } catch (e) {}
    }
  }, [perfil?.paleta_cores]);

  useEffect(() => {
    // Listener para quando paleta é alterada nas configurações
    const handlePaletaUpdate = () => {
      try {
        const local = localStorage.getItem("paleta-cores-advogado");
        if (local) aplicarPaleta(JSON.parse(local));
        else setPaletaCores(null);
      } catch (e) {}
    };
    window.addEventListener("paletaCoresAtualizada", handlePaletaUpdate);
    return () => window.removeEventListener("paletaCoresAtualizada", handlePaletaUpdate);
  }, []);
  // Estados para configurações e logo
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [logoUser, setLogoUser] = useState(perfil?.logo_url || null);
  const [mostrarMaisTipos, setMostrarMaisTipos] = useState(false);
  const [camposComErro, setCamposComErro] = useState([]);

  // Estados para agendamento
  const [mostrarModalAgendar, setMostrarModalAgendar] = useState(false);
  const [mostrarMeusAgendamentos, setMostrarMeusAgendamentos] = useState(false);
  const [dataParaAgendar, setDataParaAgendar] = useState(null);

  // Atualizar logoUser quando perfil.logo_url mudar (ex: após upload no perfil)
  useEffect(() => {
    if (perfil?.logo_url) {
      console.log('Logo atualizada via perfil');
      setLogoUser(perfil.logo_url);
    }
  }, [perfil?.logo_url]);
  // Handler para selecionar tema do trending
  const handleSelectTrending = (temaEscolhido, areaEscolhida) => {
    setTema(temaEscolhido);
    if (areaEscolhida && DADOS.areasAtuacao.includes(areaEscolhida)) {
      setAreaAtuacao(areaEscolhida);
    }
  };

  // FUNÇÕES

  // Função para limpar hashtags corrompidas e marcações indesejadas
  // =====================================================
  // FUNÇÃO limparConteudo() - VERSÃO OTIMIZADA
  // =====================================================
  const limparConteudo = (texto) => {
    if (!texto) return '';

    let limpo = texto
      // Remove marcações de estrutura comuns
      .replace(/\[GANCHO\]|\[HISTÓRIA\]|\[CTA\]|\[HASHTAGS\]/gi, '')
      .replace(/GANCHO:|DESENVOLVIMENTO:|CONCLUSÃO:|CTA:/gi, '')
      .replace(/^(1\.|2\.|3\.|4\.|5\.)\s*/gm, '') // Remove numeração no início de linha
      // Remove instruções que a IA pode ter deixado
      .replace(/\(máximo?\s*\d+\s*(caracteres|chars|palavras)\)/gi, '')
      .replace(/\[.*?expressão.*?\]/gi, '') // Remove instruções de expressão do TikTok
      // Remove marcações entre colchetes como [GANCHO], [HISTÓRIA], [CTA], etc
      .replace(/\[(GANCHO|HISTÓRIA|SITUAÇÃO|EXPLICAÇÃO|SOLUÇÃO|DICA|CTA|HASHTAGS|JURÍDICA|PRÁTICA)[^\]]*\]/gi, '')
      // Remove marcações de instrução que a IA pode ter incluído
      .replace(/📍\s*(LINHA|RESTANTE|GANCHO|HOOK).*?:/gi, '')
      .replace(/\[?(ROTEIRO DO VÍDEO|LEGENDA PRONTA|EXEMPLO|INSTRUÇÕES|REGRAS)\]?:?/gi, '')
      .replace(/^(GANCHO|HOOK|CTA|HISTÓRIA|EXPLICAÇÃO|SOLUÇÃO|SITUAÇÃO|DICA)(\s*-)?(\s*EMOCIONAL)?(\s*JURÍDICA)?(\s*PRÁTICA)?(\s*até \d+ caracteres)?:?\s*/gim, '')
      .replace(/^\(?(ATÉ \d+ CARACTERES|VISÍVEL NO FEED|após o "mais"|máximo \d+ caracteres)\)?:?\s*/gim, '')
      // Remove hashtags corrompidas (fragmentos sem sentido como #ção, #ídicas, etc)
      .replace(/#[çãõáéíóúâêîôûàèìòùäëïöü][a-zA-ZçãõáéíóúâêîôûàèìòùäëïöüÇÃÕÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÄËÏÖÜ]*\b/gi, '')
      // Remove hashtags muito curtas (menos de 4 caracteres após o #)
      .replace(/#\w{1,3}\b/g, '')
      // Remove linhas que contêm apenas hashtags corrompidas/fragmentos
      .replace(/^\s*[çãõáéíóúâêîôû][a-zA-ZçãõáéíóúâêîôûàèìòùäëïöüÇÃÕÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÄËÏÖÜ]*(\s+[çãõáéíóúâêîôû][a-zA-ZçãõáéíóúâêîôûàèìòùäëïöüÇÃÕÁÉÍÓÚÂÊÎÔÛÀÈÌÒÙÄËÏÖÜ]*)*\s*$/gm, '')
      // Limpa espaços extras
      .replace(/  +/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s*\n+/, '')
      .trim();

    return limpo;
  };

  // =====================================================
  // FUNÇÃO validarConteudo() - NOVA
  // Verifica qualidade do conteúdo gerado
  // =====================================================
  const validarConteudo = (texto, tipo, formato) => {
    const problemas = [];

    if (!texto || texto.length < 50) {
      problemas.push('Conteúdo muito curto');
      return { valido: false, problemas };
    }

    // Validação específica para Instagram Feed
    if (tipo === 'post-instagram' && formato === 'feed') {
      const primeiraLinha = texto.split('\n')[0] || '';

      if (primeiraLinha.length > 150) {
        problemas.push(`Gancho muito longo (${primeiraLinha.length} chars). Ideal: até 125.`);
      }

      if (!primeiraLinha.match(/[?!…👇🔥⚠️💡]/)) {
        problemas.push('Gancho pode ser mais impactante (sem emoji ou pontuação forte)');
      }
    }

    // Validação de hashtags
    const hashtags = texto.match(/#\w+/g) || [];
    const hashtagsComAcento = hashtags.filter(h => /[áàâãéèêíìîóòôõúùûç]/i.test(h));

    if (hashtagsComAcento.length > 0) {
      problemas.push(`Hashtags com acento: ${hashtagsComAcento.join(', ')}`);
    }

    // Verifica se copiou exemplos genéricos do prompt
    const frasesGenericas = [
      'olá, tudo bem',
      'hoje vou falar sobre',
      'você sabia que muitas pessoas'
    ];

    const textoLower = texto.toLowerCase();
    frasesGenericas.forEach(frase => {
      if (textoLower.includes(frase)) {
        problemas.push(`Possível texto genérico detectado`);
      }
    });

    return {
      valido: problemas.length === 0,
      problemas,
      metricas: {
        caracteres: texto.length,
        palavras: texto.split(/\s+/).length,
        hashtags: hashtags.length,
        ganchoLength: (texto.split('\n')[0] || '').length
      }
    };
  };

  const gerarConteudo = async () => {
    // Validação com destaque visual
    const erros = [];
    if (!tipoConteudo) erros.push('tipoConteudo');
    if (!areaAtuacao) erros.push('areaAtuacao');
    if (!tema) erros.push('tema');

    if (erros.length > 0) {
      setCamposComErro(erros);

      // Scroll até o primeiro campo com erro
      const nomeCampo = erros[0] === 'tipoConteudo' ? 'Tipo de Conteúdo' :
        erros[0] === 'areaAtuacao' ? 'Área de Atuação' : 'Tema/Assunto';

      // Encontrar e focar o elemento
      const elemento = document.getElementById(`campo-${erros[0]}`);
      if (elemento) {
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elemento.focus?.();
      }

      return;
    }

    setCamposComErro([]);
    setLoading(true);
    setConteudoGerado('');

    try {
      const prompt = construirPrompt();

      const response = await fetchAuth('https://blasterskd.com.br/api/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) throw new Error(`Erro: ${response.status}`);

      const data = await response.json();
      setConteudoGerado(limparConteudo(data.content));
      setImagemPreview(null); // Limpa a imagem anterior ao gerar novo conteúdo
      setModoEdicao(false); // Volta para modo preview

      // Scroll automático para o preview
      setTimeout(() => {
        const previewSection = document.getElementById('preview-section');
        if (previewSection) {
          previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      // Auto-gerar imagem (Agilizar o processo)
      const formatoAuto = (formatoPost === 'stories' || formatoPost === 'reels') ? 'stories' :
        (tipoConteudo === 'post-facebook') ? 'landscape' : 'quadrado';

      // Chamar geração de imagem sem bloquear a UI (async)
      // Stories/Reels gera automaticamente, Feed o usuário escolhe
      setImagemPreview(null);
      if (imagemPreviewRef.current) imagemPreviewRef.current = null;
      setModoImagem(null);
      setImagemUpload(null);

      // Apenas Stories/Reels gera imagem automaticamente
      if (formatoPost === 'stories' || formatoPost === 'reels') {
        setLoadingImagem(true);
        gerarImagem(limparConteudo(data.content), 'stories');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('❌ Erro ao gerar conteúdo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const construirPrompt = () => {
    const tipo = DADOS.tiposConteudo.find(t => t.id === tipoConteudo);
    const tam = DADOS.tamanhos.find(t => t.id === tamanho);
    const areaNome = DADOS.areasAtuacao.find(a => a.id === areaAtuacao)?.nome || areaAtuacao;

    // Configuração de tamanho otimizada
    const tamanhoConfig = {
      'curto': {
        palavras: '80-120 palavras',
        instrucao: 'Texto curto e direto ao ponto.',
        hashtags: '5-7 hashtags'
      },
      'medio': {
        palavras: '150-200 palavras',
        instrucao: 'Texto de tamanho médio.',
        hashtags: '8-10 hashtags'
      },
      'longo': {
        palavras: '250-350 palavras',
        instrucao: 'Texto completo e detalhado.',
        hashtags: '10-15 hashtags'
      }
    };

    const config = tamanhoConfig[tamanho] || tamanhoConfig['medio'];
    const isStoriesReels = tipoConteudo === 'post-instagram' && (formatoPost === 'stories' || formatoPost === 'reels');

    // Prompt base otimizado - mais conciso
    let prompt = `Crie ${tipo?.nome} sobre "${tema}" (área: ${areaNome}).
Público: ${publicoAlvo || 'geral'} | Tom: ${tom}
`;

    // Só adicionar instruções de tamanho para Feed (não Stories)
    if (!isStoriesReels) {
      prompt += `
⚠️ TAMANHO DO TEXTO - OBRIGATÓRIO RESPEITAR:
- Extensão: ${config.palavras}
- Instrução: ${config.instrucao}
- Quantidade de hashtags: ${config.hashtags}
`;
    }

    if (tipoConteudo === 'post-instagram') {

      if (isStoriesReels) {
        // Obter template selecionado para stories
        const template = DADOS.templatesStory.find(t => t.id === templateStory) || DADOS.templatesStory[0];

        prompt += `FORMATO INSTAGRAM ${formatoPost.toUpperCase()} - TEMPLATE: ${template.nome.toUpperCase()}:

TEMA: ${tema} (área: ${areaNome})
FORMATO: ${formatoPost === 'stories' ? 'Stories (vertical 9:16)' : 'Reels (vídeo vertical 9:16)'}
ESTILO VISUAL: ${template.desc}

⚠️ REGRA PRINCIPAL: Para ${formatoPost}, o texto deve ser MUITO CURTO e VISUAL.
As pessoas passam rapidamente pelos stories/reels, então cada palavra conta!

ESTRUTURA PARA ESTE TEMPLATE (${template.nome}):
`;

        if (template.id === 'voce-sabia') {
          prompt += `1. PERGUNTA DE CURIOSIDADE (Ex: "Você sabia que...?")
2. RESPOSTA DIRETA E CURTA
3. CTA SIMPLES ("Responda aqui")`;
        } else if (template.id === 'bullets') {
          prompt += `1. TÍTULO ("3 Direitos que você tem...")
2. LISTA DE 3 PONTOS (Frases curtíssimas)
3. CTA DE SALVAMENTO`;
        } else if (template.id === 'estatistica') {
          prompt += `1. DADO IMPACTANTE ("80% dos casos...")
2. EXPLICAÇÃO EM 1 FRASE
3. CTA DE COMPARTILHAMENTO`;
        } else if (template.id === 'urgente') {
          prompt += `1. ALERTA ("Prazo acabando!", "Cuidado!")
2. O QUE FAZER AGORA (Instrução ultra rápida)
3. CTA DE URGÊNCIA`;
        } else {
          prompt += `1. GANCHO (1-2 linhas)
2. PONTO PRINCIPAL (2-3 linhas)
3. CTA (1 linha)`;
        }

        prompt += `

REGRAS GERAIS:
- Máximo 30-40 palavras no total
- Frases MUITO curtas (máximo 10 palavras por frase)
- Use emojis para dar destaque
- Linguagem direta e urgente
- Pense que o texto vai aparecer sobre uma imagem

Crie o texto agora sobre "${tema}":`;
      } else {
        // Prompt otimizado para Instagram Feed
        prompt += `INSTAGRAM FEED sobre "${tema}":

1. GANCHO (MÁX 125 CARACTERES - CRÍTICO!)
   Primeira linha visível no feed. Use emoji + frase impactante + "..."

2. DESENVOLVIMENTO (${config.palavras})
   - Situação/exemplo real sobre ${tema}
   - O que a lei diz (simples)
   - Dica prática

3. CTA - Pergunta que gera comentários

4. HASHTAGS (${config.hashtags}) - SEM acentos

REGRAS:
✓ Gancho DEVE ter no máximo 125 caracteres
✓ Parágrafos curtos (2-3 linhas)
✓ Texto pronto para copiar e colar
✓ NÃO inclua marcações como [GANCHO] no texto

Crie agora:`;
      }
    } else if (tipoConteudo === 'post-facebook') {
      prompt += `FORMATO FACEBOOK - TEXTO FINAL PRONTO PARA PUBLICAÇÃO:

TEMA DO POST: ${tema} (área: ${areaNome})

Gere o texto EXATAMENTE como será postado no Facebook sobre "${tema}".
NÃO copie o exemplo abaixo - ele é apenas para mostrar o ESTILO.
Crie conteúdo 100% ORIGINAL sobre "${tema}".

ESTILO do post (NÃO COPIE, apenas inspire-se):
- Comece com pergunta ou fato interessante sobre o tema
- Conte uma história ou exemplo relacionado
- Explique a lei de forma simples
- Termine com pergunta para engajamento

---

INSTRUÇÕES:
- O conteúdo deve ser 100% sobre "${tema}"
- NÃO copie exemplos, crie conteúdo ORIGINAL
- Tamanho: ${config.palavras}
- Tom conversacional e pessoal
- ${tamanho !== 'curto' ? 'Conte uma história ou exemplo prático' : 'Seja direto mas amigável'}
- Termine com pergunta para gerar comentários
- ${config.hashtags} no final, sem acentos
- Parágrafos curtos, fáceis de ler no celular`;
    } else if (tipoConteudo === 'post-tiktok') {
      prompt += `FORMATO TIKTOK - ROTEIRO PRONTO PARA GRAVAR:

TEMA DO VÍDEO: ${tema} (área: ${areaNome})

Gere um roteiro de vídeo ${tamanho === 'curto' ? '(15-30 segundos)' : tamanho === 'medio' ? '(30-60 segundos)' : '(60-90 segundos)'} + legenda pronta.

IMPORTANTE: O roteiro deve ser 100% sobre "${tema}".
NÃO copie o exemplo abaixo - crie conteúdo ORIGINAL sobre o tema.

ESTRUTURA DO ROTEIRO:

[ROTEIRO DO VÍDEO]

🎬 CENA 1 (Expressão e instrução):
"Fala sobre ${tema} de forma impactante"

🎬 CENA 2 (Desenvolvimento):
"Pontos principais sobre ${tema}"

🎬 CENA 3 (CTA):
"Chamada para ação"

---

📝 LEGENDA PRONTA:
Legenda curta sobre ${tema} + hashtags

---

INSTRUÇÕES:
- O conteúdo deve ser 100% sobre "${tema}"
- NÃO copie exemplos, crie conteúdo ORIGINAL
- Linguagem SUPER informal, como conversa com amigo
- ${tamanho === 'curto' ? '2 pontos principais' : tamanho === 'medio' ? '3 pontos principais' : '4-5 pontos principais'}
- Frases curtas e diretas
- Indique expressões e gestos entre colchetes
- Legenda separada com ${config.hashtags} sem acentos`;
    } else if (tipoConteudo === 'post-linkedin') {
      prompt += `FORMATO LINKEDIN - TEXTO FINAL PRONTO PARA PUBLICAÇÃO:

TEMA DO POST: ${tema} (área: ${areaNome})

Gere o texto EXATAMENTE como será postado no LinkedIn sobre "${tema}".
NÃO copie exemplos - crie conteúdo 100% ORIGINAL sobre o tema.

ESTILO (inspire-se, NÃO copie):
- Comece com pergunta ou situação real sobre o tema
- Use dados/números quando possível
- Tom profissional mas acessível
- Termine com pergunta para engajamento

---

INSTRUÇÕES:
- O conteúdo deve ser 100% sobre "${tema}"
- NÃO copie exemplos, crie conteúdo ORIGINAL
- Tamanho: ${config.palavras}
- Parágrafos curtos (1-2 linhas)
- Setas (→) para listar pontos
- ${config.hashtags} profissionais no final, sem acentos
- Termine com pergunta para gerar engajamento`;
    } else if (tipoConteudo === 'artigo') {
      prompt += `FORMATO ARTIGO/BLOG - TEXTO FINAL PRONTO PARA PUBLICAÇÃO:

TEMA DO ARTIGO: ${tema} (área: ${areaNome})

Gere o artigo completo sobre "${tema}", pronto para publicar em blog ou site.
NÃO copie exemplos - crie conteúdo 100% ORIGINAL sobre o tema.

ESTRUTURA:
# Título sobre ${tema} (SEO-Friendly)

Introdução contextualizando "${tema}"

${tamanho !== 'curto' ? '## Subtítulos desenvolvendo aspectos de ' + tema : 'Desenvolvimento direto sobre ' + tema}

## Conclusão com recomendações práticas

---

INSTRUÇÕES:
- O conteúdo deve ser 100% sobre "${tema}"
- NÃO copie exemplos, crie conteúdo ORIGINAL
- Tamanho: ${config.palavras}
- Título otimizado para SEO
- ${tamanho === 'curto' ? 'Texto direto, sem subtítulos' : 'Use subtítulos para organizar'}
- Linguagem clara, evite juridiquês
- Parágrafos de 3-4 linhas no máximo
- Exemplos práticos quando possível`;
    } else if (tipoConteudo === 'thread') {
      prompt += `FORMATO THREAD X/TWITTER - TEXTO FINAL PRONTO PARA PUBLICAÇÃO:

TEMA DA THREAD: ${tema} (área: ${areaNome})

Gere a thread completa sobre "${tema}", pronta para postar tweet por tweet.
NÃO copie exemplos - crie conteúdo 100% ORIGINAL sobre o tema.

ESTRUTURA:
1/ 🧵 Gancho sobre ${tema}
2/ Primeiro ponto sobre ${tema}
3/ Segundo ponto sobre ${tema}
...
Último/ CTA + hashtags

---

INSTRUÇÕES:
- O conteúdo deve ser 100% sobre "${tema}"
- NÃO copie exemplos, crie conteúdo ORIGINAL
- ${tamanho === 'curto' ? '4-5 tweets' : tamanho === 'medio' ? '6-7 tweets' : '8-10 tweets'}
- Cada tweet: máximo 280 caracteres
- Numere todos (1/, 2/, etc)
- Primeiro tweet: gancho + "🧵"  
- Último tweet: CTA + hashtags sem acentos
- Tom direto e informal`;
    }

    // Regras finais - versão otimizada
    prompt += `

REGRAS:
✓ Conteúdo 100% sobre "${tema}"
✓ Tamanho: ${config.palavras}
✓ Texto pronto para copiar e colar
✓ Sem juridiquês excessivo
✓ Hashtags SEM acentos (Ex: #Previdencia, não #Previdência)
✓ Emojis com moderação

Crie agora:`;

    return prompt;
  };

  const copiarConteudo = () => {
    navigator.clipboard.writeText(conteudoGerado);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // Função para publicar nas redes sociais
  const publicarNaRede = () => {
    if (!conteudoGerado) return;

    const textoEncoded = encodeURIComponent(conteudoGerado);

    switch (tipoConteudo) {
      case 'post-facebook':
        // Facebook Share Dialog
        window.open(
          `https://www.facebook.com/sharer/sharer.php?quote=${textoEncoded}`,
          '_blank',
          'width=600,height=400'
        );
        break;

      case 'post-linkedin':
        // LinkedIn Share
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://juriscontent.com')}&summary=${textoEncoded}`,
          '_blank',
          'width=600,height=400'
        );
        break;

      case 'thread':
        // Twitter/X Intent
        window.open(
          `https://twitter.com/intent/tweet?text=${textoEncoded.substring(0, 280)}`,
          '_blank',
          'width=600,height=400'
        );
        break;

      case 'post-instagram':
      case 'post-tiktok':
      default:
        // Para Instagram e TikTok, copia o texto e abre o app
        navigator.clipboard.writeText(conteudoGerado);

        const rede = tipoConteudo === 'post-instagram' ? 'Instagram' :
          tipoConteudo === 'post-tiktok' ? 'TikTok' : 'rede social';

        alert(`✅ Texto copiado!\n\nAgora:\n1. Abra o ${rede}\n2. Crie um novo post\n3. Cole o texto (Ctrl+V ou ⌘+V)\n\nO ${rede} não permite pré-preencher posts por link.`);

        // Tentar abrir o app
        if (tipoConteudo === 'post-instagram') {
          window.open('https://instagram.com', '_blank');
        } else if (tipoConteudo === 'post-tiktok') {
          window.open('https://tiktok.com', '_blank');
        }
        break;
    }
  };

  const baixarImagem = () => {
    const link = document.createElement('a');
    link.download = `post-juridico-${Date.now()}.png`;
    link.href = imagemGerada;
    link.click();
  };

  const gerarImagem = async (textoOverride = null, formatoOverride = null) => {
    const textoUsar = textoOverride || conteudoGerado;
    const formatoUsar = formatoOverride || formatoImagem;

    console.log('🎨 [INICIO] gerarImagem chamado');
    console.log('   - textoOverride:', textoOverride ? 'SIM' : 'NÃO');
    console.log('   - formatoOverride:', formatoOverride);
    console.log('   - formatoUsar:', formatoUsar);

    if (!textoUsar) {
      alert('Gere o conteúdo primeiro!');
      return;
    }

    setLoadingImagem(true);
    console.log('✅ Loading iniciado');

    try {
      // Se for Stories
      if (formatoUsar === 'stories') {
        console.log('📱 Gerando Story com template:', templateStory);

        const storyBody = {
          texto: textoUsar?.substring(0, 600),
          tema: tema,
          area: areaAtuacao,
          template: templateStory,
          paleta_cores: paletaCores,
          tipo_imagem: tipoImagemStory,
          nome_advogado: user?.nome || '',
          oab: user?.oab || '',
          telefone: user?.telefone || '',
          instagram: user?.instagram || '',
          logo: logoUser || perfil?.logo_url || '',
        };

        if (conteudoStoryEditavel) {
          console.log('🎨 Renderizando com conteúdo editado');
          storyBody.conteudo_editado = conteudoStoryEditavel;
        }

        // Iniciar temporizador
        setTempoGeracao(0);
        setTentativaGeracao(1);
        setStatusGeracao('Gerando conteúdo com IA...');
        timerGeracaoRef.current = setInterval(() => {
          setTempoGeracao(prev => prev + 1);
        }, 1000);

        const MAX_TENTATIVAS = 2;
        let storyData = null;

        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
          try {
            setTentativaGeracao(tentativa);
            if (tentativa === 1) {
              setStatusGeracao('Gerando conteúdo com IA...');
            } else {
              setStatusGeracao(`Tentativa ${tentativa}/${MAX_TENTATIVAS} — Regerando...`);
            }

            const storyResponse = await fetchAuth('https://blasterskd.com.br/api/gerar-story', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(storyBody)
            });

            if (!storyResponse.ok) {
              const errData = await storyResponse.json().catch(() => ({}));

              // Verificar se é erro de limite de gerações
              if (storyResponse.status === 403 && errData?.error?.includes('Limite')) {
                clearInterval(timerGeracaoRef.current);
                timerGeracaoRef.current = null;
                setStatusGeracao('');
                setLoadingImagem(false);
                alert(`🚫 ${errData.error}\n\nVocê usou ${errData.usado}/${errData.limite} gerações do plano ${errData.plano}.\n\nFaça upgrade para continuar gerando conteúdo!`);
                return;
              }

              const isTimeout = errData?.details?.includes('timeout') || errData?.details?.includes('Timeout');
              if (isTimeout && tentativa < MAX_TENTATIVAS) {
                console.log(`⚠️ Timeout na tentativa ${tentativa}, retentando...`);
                setStatusGeracao(`Timeout na renderização. Tentando novamente...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
              }
              throw new Error(errData?.details || 'Erro ao gerar Story');
            }

            storyData = await storyResponse.json();
            if (storyData.success && storyData.imageUrl) {
              setStatusGeracao('Finalizando...');
              break;
            } else {
              throw new Error('Falha ao gerar Story');
            }
          } catch (e) {
            if (tentativa >= MAX_TENTATIVAS) {
              clearInterval(timerGeracaoRef.current);
              timerGeracaoRef.current = null;
              setStatusGeracao('');
              throw e;
            }
            console.log(`⚠️ Erro tentativa ${tentativa}:`, e.message);
            setStatusGeracao(`Erro na tentativa ${tentativa}. Retentando...`);
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        // Parar temporizador
        clearInterval(timerGeracaoRef.current);
        timerGeracaoRef.current = null;
        setStatusGeracao('');

        if (storyData?.success && storyData?.imageUrl) {
          console.log('✅ Story gerado:', storyData.imageUrl);
          imagemPreviewRef.current = storyData.imageUrl;
          setImagemGerada(storyData.imageUrl);
          setImagemPreview(storyData.imageUrl);

          if (storyData.conteudo) {
            setConteudoStoryEditavel(storyData.conteudo);
          }

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
              console.log('⚠️ Erro ao salvar Story:', e);
            }
          }
        }

        setConteudoStoryEditavel(storyData?.conteudo || null);
        setLoadingImagem(false);
        return;
      }

      console.log('📝 Gerando prompt e bullets...');

      // Usar backend local (evita problemas de CORS)
      const n8nResponse = await fetchAuth('https://blasterskd.com.br/api/gerar-prompt-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tema: tema,
          area: areaAtuacao,
          estilo: estiloImagem,
          formato: formatoUsar,
          texto: textoUsar?.substring(0, 600),
          paleta_cores: paletaCores
        })
      });

      if (!n8nResponse.ok) {
        throw new Error('Erro ao gerar prompt');
      }

      const n8nData = await n8nResponse.json();
      console.log('✅ Resposta n8n:', n8nData);

      const promptFinal = n8nData.promptFinal || '';
      let bullet1 = n8nData.bullet1 || '';
      let bullet2 = n8nData.bullet2 || '';
      let bullet3 = n8nData.bullet3 || '';
      const imageUrl = n8nData.imageUrl || '';

      // Se bullets forem genéricos, extrair do conteúdo gerado
      const bulletsGenericos = ['informação jurídica relevante', 'direitos e deveres', 'orientação profissional'];
      const bulletsSaoGenericos = bulletsGenericos.some(g =>
        bullet1.toLowerCase().includes(g) ||
        bullet2.toLowerCase().includes(g) ||
        bullet3.toLowerCase().includes(g)
      ) || (!bullet1 && !bullet2 && !bullet3);

      if (bulletsSaoGenericos && conteudoGerado) {
        console.log('⚠️ Bullets genéricos detectados, extraindo do conteúdo...');

        // Extrair pontos-chave do conteúdo
        const linhas = conteudoGerado.split('\n').filter(l => l.trim());
        const pontosChave = [];

        for (const linha of linhas) {
          // Pegar linhas que começam com emoji ou bullet
          if (/^[•✓✔️⚖️📌💡🔹▸➤]/.test(linha.trim()) || /^\d+[.)]/.test(linha.trim())) {
            const textoLimpo = linha.replace(/^[•✓✔️⚖️📌💡🔹▸➤\d.)\s]+/, '').trim();
            if (textoLimpo.length > 10 && textoLimpo.length < 80) {
              pontosChave.push(textoLimpo);
            }
          }
        }

        // Se encontrou pontos, usar. Senão, extrair frases curtas do texto
        if (pontosChave.length >= 3) {
          bullet1 = pontosChave[0];
          bullet2 = pontosChave[1];
          bullet3 = pontosChave[2];
        } else {
          // Extrair frases curtas significativas
          const frases = conteudoGerado
            .replace(/#\w+/g, '') // remover hashtags
            .split(/[.!?]/)
            .map(f => f.trim())
            .filter(f => f.length > 20 && f.length < 80 && !f.includes('\n'));

          if (frases.length >= 3) {
            // Pegar frases do meio do texto (não o gancho inicial)
            const meio = Math.floor(frases.length / 3);
            bullet1 = frases[meio] || '';
            bullet2 = frases[meio + 1] || '';
            bullet3 = frases[meio + 2] || '';
          }
        }

        console.log('📝 Bullets extraídos:', { bullet1, bullet2, bullet3 });
      }

      console.log('📸 Bullets finais:', { bullet1, bullet2, bullet3 });

      if (!imageUrl) {
        throw new Error('Nenhuma imagem foi gerada');
      }

      console.log('🎨 Adicionando texto...');
      const logoEnviar = logoUser || perfil?.logo_url || '';
      console.log('Logo a enviar:', logoEnviar ? (logoEnviar.substring(0, 60) + '...') : 'NENHUMA');
      console.log('🎨 Estilo:', estiloImagem);
      console.log('🎨 Paleta de Cores:', paletaCores ? 'SIM' : 'NÃO');

      // Extrair cores da paletaCores se existir
      const corPrimaria = paletaCores?.cores?.[0] || null;
      const corSecundaria = paletaCores?.cores?.[1] || null;
      const corAcento = paletaCores?.cores?.[2] || paletaCores?.cores?.[0] || null;

      console.log('🎨 Cores a enviar:', { corPrimaria, corSecundaria, corAcento });

      const backendResponse = await fetchAuth('https://blasterskd.com.br/api/gerar-imagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          tema: tema,
          area: areaAtuacao,
          nomeAdvogado: user.nome,
          oab: user.oab,
          instagram: user.instagram || '',
          email: '',
          telefone: '',
          formato: formatoUsar,
          estilo: estiloImagem,
          logo: logoUser || perfil?.logo_url || '',
          bullet1: bullet1,
          bullet2: bullet2,
          bullet3: bullet3,
          // Cores customizadas da identidade visual
          corPrimaria: corPrimaria,
          corSecundaria: corSecundaria,
          corAcento: corAcento
        })
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();

        // Verificar se é erro de limite de gerações
        if (backendResponse.status === 403 && errorData?.error?.includes('Limite')) {
          setLoadingImagem(false);
          alert(`🚫 ${errorData.error}\n\nVocê usou ${errorData.usado}/${errorData.limite} gerações do plano ${errorData.plano}.\n\nFaça upgrade para continuar gerando conteúdo!`);
          return;
        }

        throw new Error(errorData.details || 'Erro ao processar imagem');
      }

      const backendData = await backendResponse.json();
      console.log('✅ Imagem final recebida:', backendData.imageUrl);

      if (!backendData.imageUrl) {
        throw new Error('URL da imagem não retornada pela API');
      }

      console.log('📸 Atualizando estados com a imagem...');
      imagemPreviewRef.current = backendData.imageUrl;
      setImagemGerada(backendData.imageUrl);
      setImagemPreview(backendData.imageUrl);
      console.log('✅ Estados atualizados! imagemPreview agora é:', backendData.imageUrl.substring(0, 50));
      setMostrarModalImagem(false); // Fecha o modal
      setModoEdicao(false); // Garante que está no modo preview

      // 🔷 SUPABASE: Salvar imagem automaticamente
      if (onSalvarImagem) {
        try {
          await onSalvarImagem({
            url: backendData.imageUrl,
            tema: tema,
            area: areaAtuacao,
            tipoConteudo: tipoConteudo,
            formato: formatoPost || formatoImagem
          });
          console.log('✅ Imagem salva no Supabase');
        } catch (e) {
          console.log('⚠️ Erro ao salvar no Supabase:', e);
        }
      }

    } catch (error) {
      console.error('❌ ERRO na geração de imagem:', error);
      console.error('   Stack:', error.stack);
      alert('❌ Erro ao gerar imagem: ' + error.message);
    } finally {
      console.log('🏁 Finalizando geração de imagem (setLoadingImagem = false)');
      setLoadingImagem(false);
    }
  };

  // JSX RENDER...
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <Scale className="w-10 h-10 text-amber-400" />
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Criador de Conteúdo</h1>
              <p className="text-slate-300 text-sm">Olá, {user.nome}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-center sm:justify-end">
            {onAbrirGaleria && (
              <button
                onClick={onAbrirGaleria}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all text-sm"
                title="Minhas Imagens"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Galeria</span>
              </button>
            )}
            <button
              onClick={() => setMostrarMeusAgendamentos(true)}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all text-sm"
              title="Meus Agendamentos"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Agendamentos</span>
            </button>
            {onAbrirPerfil && (
              <button
                onClick={onAbrirPerfil}
                className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all text-sm"
                title="Meu Perfil"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Perfil</span>
              </button>
            )}
            {onAbrirPlanos && (
              <button
                onClick={onAbrirPlanos}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border border-amber-500/30 rounded-lg text-amber-400 transition-all text-sm"
                title="Ver Planos"
              >
                <Crown className="w-4 h-4" />
                <span className="hidden sm:inline">Planos</span>
              </button>
            )}
            <button
              onClick={() => setMostrarConfig(true)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-400 transition-all text-sm"
              title="Configurar Identidade Visual"
            >
              <Palette className="w-4 h-4" />
              <span className="hidden sm:inline">Visual</span>
            </button>
            <button
              onClick={() => {
                console.log('🚪 Botão Sair clicado');
                if (onLogout) {
                  onLogout();
                } else {
                  console.log('❌ onLogout não está definido!');
                }
              }}
              className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-red-600/80 rounded-lg text-white transition-all text-sm"
              title="Sair do Sistema"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        {/* CARD DE PERFIL E PALETA DE CORES */}
        <div className={`mb-6 p-4 rounded-xl border ${!paletaCores ? 'bg-amber-500/10 border-amber-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
          <div className="flex flex-wrap items-center gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3">
              {logoUser ? (
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 bg-slate-700">
                  <img src={logoUser} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  onClick={onAbrirPerfil}
                  className="w-14 h-14 rounded-full border-2 border-dashed border-amber-400/50 bg-slate-700/50 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-all"
                >
                  <Camera className="w-6 h-6 text-amber-400/50" />
                </div>
              )}
              <div>
                <div className="font-semibold text-white">{user.nome || 'Seu Nome'}</div>
                <div className="text-xs text-slate-400">{perfil?.oab || 'OAB não informada'}</div>
              </div>
            </div>
            {/* Separador */}
            <div className="hidden sm:block w-px h-10 bg-slate-600" />
            {/* Paleta de Cores */}
            <div className="flex items-center gap-3">
              {paletaCores ? (
                <>
                  <div className="flex gap-1">
                    {paletaCores.cores?.slice(0, 3).map((cor, idx) => (
                      <div key={idx} className="w-6 h-6 rounded-full border border-slate-600" style={{ backgroundColor: cor }} />
                    ))}
                  </div>
                  <div className="text-sm text-slate-300">
                    <span className="text-amber-400 font-medium">Paleta:</span> {paletaCores.nome || 'Definida'}
                  </div>
                </>
              ) : (
                <div
                  onClick={() => setMostrarConfig(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-amber-400/50 bg-slate-700/30 cursor-pointer hover:bg-slate-700/50 transition-all"
                >
                  <Palette className="w-5 h-5 text-amber-400/50" />
                  <span className="text-sm text-amber-400/70">Escolher paleta de cores</span>
                </div>
              )}
            </div>
            {/* Alerta se faltar algo */}
            {!paletaCores && (
              <div className="flex-1 flex items-center justify-end">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Defina sua paleta para imagens personalizadas</span>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* GRID PRINCIPAL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* COLUNA ESQUERDA - FORMULÁRIO */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Lightbulb className="w-6 h-6 text-amber-400" />
              Configurar Conteúdo
            </h2>

            {/* Tipo de Conteúdo */}
            <div id="campo-tipoConteudo" className={`mb-6 p-3 rounded-lg transition-all ${camposComErro.includes('tipoConteudo') ? 'bg-red-500/10 border border-red-500/50 ring-2 ring-red-500/30' : ''}`}>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Tipo de Conteúdo *
                {camposComErro.includes('tipoConteudo') && <span className="text-red-400 ml-2 text-xs">← Selecione uma opção</span>}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DADOS.tiposConteudo
                  .filter(tipo => ['post-instagram', 'post-facebook'].includes(tipo.id))
                  .map((tipo) => {
                    // Função para renderizar o ícone correto
                    const renderIcon = () => {
                      const iconClass = `w-6 h-6 ${tipoConteudo === tipo.id ? 'text-amber-400' : 'text-slate-300'}`;
                      switch (tipo.icon) {
                        case 'instagram':
                          return <Instagram className={iconClass} />;
                        case 'facebook':
                          return <Facebook className={iconClass} />;
                        case 'tiktok':
                          return (
                            <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                            </svg>
                          );
                        case 'linkedin':
                          return <Linkedin className={iconClass} />;
                        case 'blog':
                          return <FileText className={iconClass} />;
                        case 'twitter':
                          return (
                            <svg className={iconClass} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          );
                        default:
                          return <MessageCircle className={iconClass} />;
                      }
                    };

                    return (
                      <button
                        key={tipo.id}
                        onClick={() => {
                          setTipoConteudo(tipo.id);
                          setCamposComErro(prev => prev.filter(c => c !== 'tipoConteudo'));
                          // Auto-selecionar formato se houver apenas um
                          if (tipo.formatos?.length === 1) {
                            setFormatoPost(tipo.formatos[0].id);
                          } else {
                            setFormatoPost('');
                          }
                        }}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center ${tipoConteudo === tipo.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50 text-slate-300'
                          }`}
                      >
                        {renderIcon()}
                        <div className="font-medium text-sm mt-1.5">{tipo.nome}</div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* SELEÇÃO DE FORMATO DO POST */}
            {tipoConteudo && (() => {
              const tipoSelecionado = DADOS.tiposConteudo.find(t => t.id === tipoConteudo);
              if (!tipoSelecionado?.formatos?.length || tipoSelecionado.formatos.length <= 1) return null;

              return (
                <div className="mb-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Formato do Post
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {tipoSelecionado.formatos.map((formato) => (
                      <button
                        key={formato.id}
                        onClick={() => setFormatoPost(formato.id)}
                        className={`flex-1 p-3 rounded-lg border transition-all ${formatoPost === formato.id
                          ? 'border-amber-400 bg-amber-400/10'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
                          }`}
                      >
                        {/* Ícone visual do formato */}
                        <div className="flex justify-center mb-2">
                          {formato.id === 'feed' && tipoConteudo === 'post-instagram' ? (
                            <div className={`w-8 h-8 border-2 rounded ${formatoPost === formato.id ? 'border-amber-400' : 'border-slate-400'}`} />
                          ) : formato.id === 'feed' && tipoConteudo === 'post-facebook' ? (
                            <div className={`w-10 h-6 border-2 rounded ${formatoPost === formato.id ? 'border-amber-400' : 'border-slate-400'}`} />
                          ) : (
                            <div className={`w-5 h-9 border-2 rounded ${formatoPost === formato.id ? 'border-amber-400' : 'border-slate-400'}`} />
                          )}
                        </div>
                        <div className={`text-sm font-medium ${formatoPost === formato.id ? 'text-amber-400' : 'text-slate-300'}`}>
                          {formato.nome}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{formato.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
            {/* ESTILOS DE STORY - Aparece logo após selecionar Stories/Reels */}
            {(formatoPost === 'stories' || formatoPost === 'reels') && (
              <div className="mb-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">Estilo do {formatoPost === 'stories' ? 'Story' : 'Reels'}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {DADOS.templatesStory.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTemplateStory(t.id)}
                      className={`p-1.5 rounded-xl border transition-all text-left flex items-center gap-3 relative overflow-hidden group ${templateStory === t.id
                        ? 'border-amber-400 bg-amber-400/10'
                        : 'border-slate-700 hover:border-slate-600 bg-slate-800/40 text-slate-300'
                        }`}
                    >
                      <MiniStoryPreview template={t.id} />
                      <div className="flex-1 pr-2">
                        <div className={`font-bold text-sm ${templateStory === t.id ? 'text-amber-400' : 'text-slate-100'}`}>
                          {t.nome}
                        </div>
                        <div className={`text-[10px] leading-tight mt-1 line-clamp-2 ${templateStory === t.id ? 'text-amber-400/70' : 'text-slate-500'}`}>
                          {t.desc}
                        </div>
                      </div>
                      {templateStory === t.id && (
                        <div className="absolute top-2 right-2">
                          <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-slate-900" />
                          </div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TIPO DE IMAGEM DO STORY */}
            {(formatoPost === 'stories' || formatoPost === 'reels') && (
              <div className="mb-6 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <label className="block text-sm font-medium text-slate-300 mb-3">Imagem de fundo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTipoImagemStory('stock')}
                    className={`p-3 rounded-xl border transition-all text-center ${tipoImagemStory === 'stock'
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'}`}
                  >
                    <ImageIcon className={`w-5 h-5 mx-auto mb-1 ${tipoImagemStory === 'stock' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div className={`text-sm font-bold ${tipoImagemStory === 'stock' ? 'text-amber-400' : 'text-slate-300'}`}>Foto Profissional</div>
                    <div className={`text-[10px] mt-0.5 ${tipoImagemStory === 'stock' ? 'text-amber-400/70' : 'text-slate-500'}`}>Banco de imagens</div>
                  </button>
                  <button
                    onClick={() => setTipoImagemStory('ia')}
                    className={`p-3 rounded-xl border transition-all text-center ${tipoImagemStory === 'ia'
                      ? 'border-amber-400 bg-amber-400/10'
                      : 'border-slate-700 hover:border-slate-600 bg-slate-800/40'}`}
                  >
                    <Sparkles className={`w-5 h-5 mx-auto mb-1 ${tipoImagemStory === 'ia' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <div className={`text-sm font-bold ${tipoImagemStory === 'ia' ? 'text-amber-400' : 'text-slate-300'}`}>Imagem IA</div>
                    <div className={`text-[10px] mt-0.5 ${tipoImagemStory === 'ia' ? 'text-amber-400/70' : 'text-slate-500'}`}>Gerada por inteligência artificial</div>
                  </button>
                </div>
              </div>
            )}

            {/* Área de Atuação */}
            <div id="campo-areaAtuacao" className={`mb-6 p-3 rounded-lg transition-all ${camposComErro.includes('areaAtuacao') ? 'bg-red-500/10 border border-red-500/50 ring-2 ring-red-500/30' : ''}`}>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                Área de Atuação *
                {camposComErro.includes('areaAtuacao') && <span className="text-red-400 ml-2 text-xs">← Selecione uma opção</span>}
              </label>
              <select
                value={areaAtuacao}
                onChange={(e) => { setAreaAtuacao(e.target.value); setCamposComErro(prev => prev.filter(c => c !== 'areaAtuacao')); }}
                className={`w-full bg-slate-700 border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${camposComErro.includes('areaAtuacao') ? 'border-red-500' : 'border-slate-600'}`}
              >
                <option value="">Selecione...</option>
                {DADOS.areasAtuacao.map((area) => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            </div>

            {/* Assunto/Tema */}
            <div id="campo-tema" className={`mb-6 p-3 rounded-lg transition-all ${camposComErro.includes('tema') ? 'bg-red-500/10 border border-red-500/50 ring-2 ring-red-500/30' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">
                  Assunto / Tema *
                  {camposComErro.includes('tema') && <span className="text-red-400 ml-2 text-xs">← Digite o tema</span>}
                </label>
                {areaAtuacao && (
                  <button
                    onClick={() => setMostrarDicasAssunto(!mostrarDicasAssunto)}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Lightbulb className="w-3 h-3" />
                    {mostrarDicasAssunto ? 'Ocultar' : 'Ver'} sugestões
                  </button>
                )}
              </div>
              <input
                type="text"
                value={tema}
                onChange={(e) => { setTema(e.target.value); setCamposComErro(prev => prev.filter(c => c !== 'tema')); }}
                placeholder="Ex: Como funciona a rescisão indireta"
                className={`w-full bg-slate-700 border rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 ${camposComErro.includes('tema') ? 'border-red-500' : 'border-slate-600'}`}
              />

              {mostrarDicasAssunto && areaAtuacao && DADOS.sugestoesAssuntos[areaAtuacao] && (
                <div className="mt-3 bg-slate-900/50 rounded-lg p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-400 font-medium mb-2">💡 Sugestões:</p>
                  <div className="space-y-1.5">
                    {DADOS.sugestoesAssuntos[areaAtuacao].map((sugestao, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setTema(sugestao);
                          setMostrarDicasAssunto(false);
                        }}
                        className="w-full text-left text-xs text-slate-300 hover:text-amber-400 hover:bg-slate-800 p-2 rounded transition-all"
                      >
                        → {sugestao}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* TRENDING TOPICS - Sugestões baseadas na área */}
            <TrendingTopicsComponent
              onSelectTema={handleSelectTrending}
              areaAtuacao={areaAtuacao}
            />
            {/* Público-Alvo */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-300">Público-Alvo</label>
                <button
                  onClick={() => setMostrarDicasPublico(!mostrarDicasPublico)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  {mostrarDicasPublico ? 'Ocultar' : 'Ver'} sugestões
                </button>
              </div>
              <input
                type="text"
                value={publicoAlvo}
                onChange={(e) => setPublicoAlvo(e.target.value)}
                placeholder="Ex: Empresários, Trabalhadores, etc."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />

              {mostrarDicasPublico && (
                <div className="mt-3 bg-slate-900/50 rounded-lg p-3 border border-amber-500/20">
                  <p className="text-xs text-amber-400 font-medium mb-2">👥 Sugestões:</p>
                  <div className="flex flex-wrap gap-2">
                    {DADOS.sugestoesPublico.map((publico, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setPublicoAlvo(publico);
                          setMostrarDicasPublico(false);
                        }}
                        className="text-xs bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 px-3 py-1.5 rounded-full border border-slate-600 hover:border-amber-500/50 transition-all"
                      >
                        {publico}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!(formatoPost === 'stories' || formatoPost === 'reels') && (
              <>
                {/* Tom - Apenas para posts que não são stories */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3">Tom do Conteúdo</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DADOS.tons.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTom(t.id)}
                        className={`p-3 rounded-lg border transition-all ${tom === t.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50 text-slate-300'
                          }`}
                      >
                        <div className="font-medium text-sm">{t.nome}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tamanho - Apenas para posts que não são stories */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-slate-300 mb-3">Tamanho</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DADOS.tamanhos.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setTamanho(t.id)}
                        className={`flex-1 p-3 rounded-lg border transition-all ${tamanho === t.id
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-slate-600 hover:border-slate-500 bg-slate-700/50 text-slate-300'
                          }`}
                      >
                        <div className="font-medium text-sm">{t.nome}</div>
                        <div className={`text-xs mt-0.5 ${tamanho === t.id ? 'text-amber-400/70' : 'text-slate-500'}`}>{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Botão Gerar */}
            <button
              onClick={gerarConteudo}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Lightbulb className="w-5 h-5" />
                  Gerar Conteúdo
                </>
              )}
            </button>
          </div>

          {/* COLUNA DIREITA - PREVIEW */}
          <div id="preview-section" className="bg-slate-800/50 backdrop-blur rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                {tipoConteudo === 'post-instagram' ? <Instagram className="w-6 h-6 text-pink-400" /> :
                  tipoConteudo === 'post-facebook' ? <Facebook className="w-6 h-6 text-blue-400" /> :
                    tipoConteudo === 'post-tiktok' ? (
                      <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                      </svg>
                    ) : <Scale className="w-6 h-6 text-amber-400" />}
                <span>
                  {tipoConteudo === 'post-instagram' ? 'Instagram' :
                    tipoConteudo === 'post-facebook' ? 'Facebook' :
                      tipoConteudo === 'post-tiktok' ? 'TikTok' :
                        'Conteúdo'}
                  {formatoPost && (
                    <span className="text-slate-400 font-normal ml-2">
                      • {formatoPost === 'feed' ? 'Feed' :
                        formatoPost === 'stories' ? 'Stories' :
                          formatoPost === 'reels' ? 'Reels' :
                            formatoPost === 'video' ? 'Vídeo' : formatoPost}
                    </span>
                  )}
                </span>
              </h2>

              {conteudoGerado && (
                <div className="flex flex-wrap gap-2 justify-end items-center">
                  {/* Botão Editar/Visualizar */}
                  <button
                    onClick={() => setModoEdicao(!modoEdicao)}
                    className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${modoEdicao
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                      }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="whitespace-nowrap">{modoEdicao ? 'Visualizar' : 'Editar'}</span>
                  </button>

                  {/* Botão Agendar */}
                  <button
                    onClick={() => setMostrarModalAgendar(true)}
                    className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-amber-400 text-sm transition-all"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="whitespace-nowrap">Agendar</span>
                  </button>

                  {/* Botão Baixar (só aparece se tiver imagem) */}
                  {imagemPreview && (
                    <button
                      onClick={async () => {
                        const response = await fetch(imagemPreview);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "juriscontent-post.png";
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                      className="flex items-center justify-center gap-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm transition-all font-medium"
                    >
                      <Download className="w-4 h-4" />
                      <span className="whitespace-nowrap">Baixar</span>
                    </button>
                  )}

                  {/* Menu Dropdown - Mais Ações */}
                  <div className="relative">
                    <button
                      onClick={() => setMostrarMenuAcoes(!mostrarMenuAcoes)}
                      className="flex items-center justify-center p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all"
                      title="Mais ações"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {mostrarMenuAcoes && (
                      <>
                        {/* Overlay para fechar ao clicar fora */}
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMostrarMenuAcoes(false)}
                        />

                        {/* Menu */}
                        <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
                          {/* Copiar */}
                          <button
                            onClick={() => {
                              copiarConteudo();
                              setMostrarMenuAcoes(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 text-white text-sm transition-all"
                          >
                            {copiado ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            <span>{copiado ? 'Copiado!' : 'Copiar texto'}</span>
                          </button>

                          {/* WhatsApp (só se tiver imagem) */}
                          {imagemPreview && (
                            <button
                              onClick={() => {
                                window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(imagemPreview), "_blank");
                                setMostrarMenuAcoes(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 text-white text-sm transition-all"
                            >
                              <MessageCircle className="w-4 h-4 text-green-400" />
                              <span>Enviar WhatsApp</span>
                            </button>
                          )}

                          {/* Copiar Link (só se tiver imagem) */}
                          {imagemPreview && (
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(imagemPreview);
                                alert("Link copiado!");
                                setMostrarMenuAcoes(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700 text-white text-sm transition-all"
                            >
                              <Link2 className="w-4 h-4" />
                              <span>Copiar link</span>
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="min-h-[500px] bg-slate-900/50 rounded-lg p-6 border border-slate-600">
              {conteudoGerado ? (
                modoEdicao ? (
                  /* MODO EDIÇÃO */
                  <div className="h-full">
                    <textarea
                      value={conteudoGerado}
                      onChange={(e) => setConteudoGerado(e.target.value)}
                      className="w-full h-[450px] bg-slate-800 border border-slate-600 rounded-lg p-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none font-mono text-sm leading-relaxed"
                      placeholder="Edite seu conteúdo aqui..."
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      ✏️ Modo edição ativo. Faça suas alterações e clique em "Visualizar" para ver o resultado.
                    </p>
                  </div>
                ) : (
                  /* MODO PREVIEW */
                  <div className="flex flex-col h-full">
                    {/* OPÇÕES DE IMAGEM - apenas para Feed */}
                    {/* OPÇÕES STORY - editar conteúdo e regerar */}
                    {(formatoPost === 'stories' || formatoPost === 'reels') && imagemPreview && !loadingImagem && conteudoStoryEditavel && (
                      <div className="mb-4 p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                        <p className="text-sm text-slate-300 mb-3 text-center font-medium">
                          Ajustar Story:
                        </p>
                        <div className="flex gap-3 justify-center flex-wrap items-center">
                          <button
                            onClick={() => setMostrarEditorConteudo(true)}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-all font-medium"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span className="whitespace-nowrap">Editar Conteúdo</span>
                          </button>
                          <button
                            onClick={() => {
                              setConteudoStoryEditavel(null);
                              setLoadingImagem(true);
                              gerarImagem(conteudoGerado, 'stories');
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm transition-all font-medium"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span className="whitespace-nowrap">Regerar Story</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {/* OPÇÕES DE IMAGEM - apenas para Feed */}
                    {formatoPost === 'feed' && !loadingImagem && (
                      <div className="mb-4 p-4 bg-slate-700/50 rounded-xl border border-slate-600">
                        <p className="text-sm text-slate-300 mb-3 text-center font-medium">
                          {imagemPreview ? 'Trocar imagem:' : 'Como deseja adicionar a imagem?'}
                        </p>
                        <div className="flex gap-3 justify-center flex-wrap items-center">
                          <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm cursor-pointer transition-all font-medium">
                            <Upload className="w-4 h-4" />
                            <span className="whitespace-nowrap">{imagemPreview ? 'Enviar outra' : 'Fazer Upload'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = async (event) => {
                                    const base64 = event.target.result;
                                    setImagemUpload(base64);
                                    setImagemPreview(base64);
                                    imagemPreviewRef.current = base64;
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <button
                            onClick={() => {
                              setLoadingImagem(true);
                              gerarImagem(limparConteudo(conteudoGerado), 'quadrado');
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm transition-all font-medium"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span className="whitespace-nowrap">{imagemPreview ? 'Gerar nova' : 'Gerar com IA'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex-1 min-h-0 flex items-start justify-center overflow-auto">
                      <div className="w-full">
                        <PreviewRedeSocial
                          key={imagemPreviewRef.current || imagemPreview || 'no-image'}
                          tipo={tipoConteudo}
                          formato={formatoPost || 'feed'}
                          conteudo={conteudoGerado}
                          usuario={user}
                          modoCompleto={true}
                          imagemPreview={imagemPreviewRef.current || imagemPreview}
                          onVisualizarImagem={imagemPreview ? () => setMostrarImagemFull(true) : null}
                          loadingImagem={loadingImagem}
                          tempoGeracao={tempoGeracao}
                          tentativaGeracao={tentativaGeracao}
                          statusGeracao={statusGeracao}
                        />
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-20">
                  {tipoConteudo === 'post-instagram' ? <Instagram className="w-16 h-16 mb-4 opacity-30" /> :
                    tipoConteudo === 'post-facebook' ? <Facebook className="w-16 h-16 mb-4 opacity-30" /> :
                      tipoConteudo === 'post-tiktok' ? (
                        <svg className="w-16 h-16 mb-4 opacity-30" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                        </svg>
                      ) : <Scale className="w-16 h-16 mb-4 opacity-30" />}
                  <p className="text-lg mb-2">Nenhum conteúdo gerado ainda</p>
                  <p className="text-sm">Configure os parâmetros e clique em "Gerar Conteúdo"</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6">

        </div>

        {/* MODAL EDITOR DE CONTEÚDO STORY */}
        {mostrarEditorConteudo && conteudoStoryEditavel && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  Editar Conteúdo do Story
                </h2>
                <button
                  onClick={() => setMostrarEditorConteudo(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Renderiza campos dinamicamente baseado no conteúdo */}
              {(() => {
                const c = conteudoStoryEditavel;
                const inputClass = "w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 focus:outline-none";
                const textareaClass = inputClass + " resize-none";
                const labelClass = "block text-sm font-medium text-slate-300 mb-1";
                const updateField = (field, value) => setConteudoStoryEditavel({ ...c, [field]: value });

                // Mapeamento de campos para labels
                const simpleFields = [
                  { key: 'pergunta', label: 'Pergunta / Título' },
                  { key: 'headline', label: 'Título' },
                  { key: 'titulo', label: 'Título' },
                  { key: 'subtitulo', label: 'Subtítulo' },
                  { key: 'alerta', label: 'Alerta' },
                  { key: 'prazo', label: 'Prazo' },
                  { key: 'acao', label: 'Ação / CTA' },
                  { key: 'insight', label: 'Insight' },
                  { key: 'conclusao', label: 'Conclusão' },
                  { key: 'dica', label: 'Dica' },
                  { key: 'destaque', label: 'Destaque / CTA' },
                  { key: 'fonte', label: 'Fonte' },
                ];

                const textareaFields = [
                  { key: 'explicacao', label: 'Explicação' },
                  { key: 'risco', label: 'Risco / Consequências' },
                ];

                return (
                  <>
                    {/* Campos simples (input) */}
                    {simpleFields.map(({ key, label }) => (
                      c[key] !== undefined && typeof c[key] === 'string' ? (
                        <div key={key} className="mb-4">
                          <label className={labelClass}>{label}</label>
                          <input type="text" value={c[key] || ''} onChange={(e) => updateField(key, e.target.value)} className={inputClass} />
                        </div>
                      ) : null
                    ))}

                    {/* Campos textarea */}
                    {textareaFields.map(({ key, label }) => (
                      c[key] !== undefined && typeof c[key] === 'string' ? (
                        <div key={key} className="mb-4">
                          <label className={labelClass}>{label}</label>
                          <textarea value={c[key] || ''} onChange={(e) => updateField(key, e.target.value)} rows={3} className={textareaClass} />
                        </div>
                      ) : null
                    ))}

                    {/* Estatística (objeto aninhado) */}
                    {c.estatistica && typeof c.estatistica === 'object' && (
                      <div className="mb-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
                        <label className="block text-sm font-semibold text-amber-400 mb-3">Estatística</label>
                        {['numero', 'contexto', 'explicacao'].map((campo) => (
                          c.estatistica[campo] !== undefined ? (
                            <div key={campo} className="mb-3">
                              <label className={labelClass}>{campo === 'numero' ? 'Número / Dado' : campo === 'contexto' ? 'Contexto' : 'Explicação'}</label>
                              {campo === 'explicacao' ? (
                                <textarea
                                  value={c.estatistica[campo] || ''}
                                  onChange={(e) => setConteudoStoryEditavel({ ...c, estatistica: { ...c.estatistica, [campo]: e.target.value } })}
                                  rows={3}
                                  className={textareaClass}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={c.estatistica[campo] || ''}
                                  onChange={(e) => setConteudoStoryEditavel({ ...c, estatistica: { ...c.estatistica, [campo]: e.target.value } })}
                                  className={inputClass}
                                />
                              )}
                            </div>
                          ) : null
                        ))}
                      </div>
                    )}

                    {/* Tópicos (array) */}
                    {c.topicos && Array.isArray(c.topicos) && (
                      <div className="mb-4">
                        <label className={labelClass}>Tópicos</label>
                        {c.topicos.map((topico, idx) => (
                          <div key={idx} className="flex items-start gap-2 mb-2">
                            <span className="text-amber-400 text-sm mt-2 font-bold min-w-[20px]">{idx + 1}.</span>
                            <textarea
                              value={topico}
                              onChange={(e) => {
                                const novos = [...c.topicos];
                                novos[idx] = e.target.value;
                                updateField('topicos', novos);
                              }}
                              rows={2}
                              className={"flex-1 " + textareaClass}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bullets (array) */}
                    {c.bullets && Array.isArray(c.bullets) && (
                      <div className="mb-4">
                        <label className={labelClass}>Bullets</label>
                        {c.bullets.map((bullet, idx) => (
                          <div key={idx} className="flex items-start gap-2 mb-2">
                            <span className="text-amber-400 text-sm mt-2 font-bold min-w-[20px]">{idx + 1}.</span>
                            <textarea
                              value={bullet}
                              onChange={(e) => {
                                const novos = [...c.bullets];
                                novos[idx] = e.target.value;
                                updateField('bullets', novos);
                              }}
                              rows={2}
                              className={"flex-1 " + textareaClass}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Botões */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setMostrarEditorConteudo(false)}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-medium transition-all"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setMostrarEditorConteudo(false);
                    setLoadingImagem(true);
                    gerarImagem(conteudoGerado, 'stories');
                  }}
                  className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Aplicar Alterações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE VISUALIZAÇÃO DA IMAGEM */}
        {mostrarImagemFull && imagemPreview && (
          <div
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
            onClick={() => setMostrarImagemFull(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh] w-full">
              <button
                onClick={() => setMostrarImagemFull(false)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-2"
              >
                <span className="text-sm">Fechar</span>
                <X className="w-6 h-6" />
              </button>
              <img
                src={imagemPreview}
                alt="Imagem do post"
                className="w-full h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-3 flex-wrap">
                <a
                  href={imagemPreview}
                  download="post-juriscontent.png"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm transition-all font-medium"
                >
                  <Download className="w-4 h-4" />
                  Baixar
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open("https://api.whatsapp.com/send?text=" + encodeURIComponent(imagemPreview), "_blank");
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-all font-medium"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(imagemPreview);
                    alert("Link copiado!");
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded-lg text-white text-sm transition-all font-medium"
                >
                  <Link2 className="w-4 h-4" />
                  Link
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIGURAÇÕES */}
        {mostrarConfig && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Settings className="w-6 h-6 text-amber-400" />
                  Configurações
                </h2>
                <button
                  onClick={() => setMostrarConfig(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-slate-400 mb-3 uppercase tracking-wider">Cores das Imagens</h3>
                  <SeletorPaletaCores />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAIS DE AGENDAMENTO */}
        <ModalAgendar
          isOpen={mostrarModalAgendar}
          onClose={() => { setMostrarModalAgendar(false); setDataParaAgendar(null); }}
          conteudo={conteudoGerado}
          imagemUrl={imagemPreview}
          titulo={tema || tipoConteudo}
          dataPadrao={dataParaAgendar}
        />

        <ModalCalendarioAgendamentos
          isOpen={mostrarMeusAgendamentos}
          onClose={() => setMostrarMeusAgendamentos(false)}
          conteudoDisponivel={!!conteudoGerado}
          onNovoAgendamento={(data) => {
            setMostrarMeusAgendamentos(false);
            if (conteudoGerado) {
              setDataParaAgendar(data);
              setTimeout(() => setMostrarModalAgendar(true), 200);
            }
          }}
        />

        {/* MODAL DE IMAGEM REMOVIDO - GERAÇÃO AGORA É AUTOMÁTICA */}
      </div>
    </div>
  );
}
