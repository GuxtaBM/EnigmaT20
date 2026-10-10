/* =====================================================================
   SEGREDO — SCRIPT
   O que você vai querer editar está em "CONFIGURAÇÕES DO ENIGMA", logo abaixo.
   ===================================================================== */

// ---------------------------------------------------------------------
// CONFIGURAÇÕES DO ENIGMA
// ---------------------------------------------------------------------

// Os cinco caracteres mostrados na tela (um campo numérico nasce embaixo de cada um).
const caracteres = ["A", "P", "H", "S", "D"];


const codigoCorreto = "44112";

// >>> ONDE ALTERAR A PÁGINA DE DESTINO <<<
// Caminho relativo: o arquivo precisa estar na mesma pasta deste segredo.html.
const paginaDestino = "revelacao.html";

const CONFIG = {
  mensagemErro:       "O coração parece não aceitar tal resposta.",
  mensagemIncompleto: "O coração não aceita coisas incompletas.",

  // Tempo entre o acerto e a navegação, para a transição terminar (ms)
  atrasoRedirecionamento: 1100,

  audio: {
    arquivo: "assets/audio/heart.mp3",
    volume: 0.8,                // 0 a 1

    // O arquivo tem ~0,4 s de silêncio no começo e ~0,35 s no fim. Para o loop não ter
    // "buraco", a repetição acontece só dentro desta janela (em segundos). O arquivo não é alterado.
    loopInicio: 0.40,
    loopFim: 41.28,

    // Detecção das batidas em tempo real (Web Audio). Se não conseguir detectar, algo parece
    // fraco demais ou forte demais: aumente ou diminua "sensibilidade" (0.15 = mais sensível).
    sensibilidade: 0.25,
    intervaloMinimoMs: 110,

    // Reserva para quando o navegador não permite analisar o áudio (ex.: abrir o arquivo
    // direto do disco, com file://). São os instantes das batidas deste mp3, em segundos.
    // Se trocar o áudio, pode apagar a lista: com a página num servidor, a detecção é automática.
    batidas: [
      0.409, 0.659, 1.159, 1.388, 1.879, 2.651, 2.852, 3.358, 3.624, 4.961,
      5.683, 5.954, 6.736, 7.246, 7.508, 7.994, 8.267, 8.783, 9.037, 9.557,
      9.829, 10.349, 10.611, 11.127, 11.399, 11.897, 12.162, 12.664, 12.928, 13.432,
      13.731, 14.276, 14.539, 15.027, 15.307, 15.798, 16.085, 16.569, 16.849, 17.316,
      17.606, 18.109, 18.392, 18.898, 19.182, 19.724, 19.981, 20.480, 20.743, 21.228,
      21.494, 22.008, 22.276, 22.766, 23.045, 23.563, 23.852, 24.323, 24.578, 25.011,
      25.288, 25.799, 26.087, 26.592, 26.873, 27.347, 27.651, 28.128, 28.416, 28.897,
      29.180, 29.677, 29.951, 30.459, 30.754, 31.250, 31.535, 32.041, 32.333, 32.841,
      33.128, 33.629, 33.893, 34.370, 34.639, 35.149, 35.455, 35.985, 36.275, 36.837,
      37.143, 37.661, 37.948, 38.431, 38.702, 39.229, 39.501, 39.994, 40.278, 40.786
    ]
  },

  pulso: {
    decaimentoMs: 170           // quão rápido o brilho apaga depois de cada batida
  }
};

// ---------------------------------------------------------------------
// ELEMENTOS E ESTADO
// ---------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const el = {
  cena: $("cena"),
  form: $("enigma"),
  colunas: $("colunas"),
  botao: $("desvendar"),
  mensagem: $("mensagem"),
  som: $("som")
};

let campos = [];
let navegando = false;          // true depois do acerto: impede reenvio e novos redirecionamentos
let pulso = 0;                  // 0..1, alimenta --pulso no CSS

// ---------------------------------------------------------------------
// CONSTRUÇÃO DOS CARACTERES E CAMPOS
// ---------------------------------------------------------------------
if (!/^\d+$/.test(codigoCorreto) || codigoCorreto.length !== caracteres.length) {
  console.warn("codigoCorreto deve ter só algarismos, um para cada item de 'caracteres'.");
}

caracteres.forEach((caractere, i) => {
  const coluna = document.createElement("div");
  coluna.className = "coluna";

  const rotulo = document.createElement("span");
  rotulo.className = "coluna__caractere";
  rotulo.textContent = caractere;
  rotulo.setAttribute("aria-hidden", "true");

  const campo = document.createElement("input");
  campo.className = "coluna__campo";
  campo.type = "text";                         // "number" aceitaria "e", "-" e setas de rolagem
  campo.inputMode = "numeric";
  campo.pattern = "[0-9]";
  campo.maxLength = 1;
  campo.autocomplete = "off";
  campo.setAttribute("aria-label", "Número de " + caractere);
  campo.dataset.indice = i;

  campo.addEventListener("focus", () => campo.select());
  campo.addEventListener("input", () => aoDigitar(i));
  campo.addEventListener("keydown", (e) => aoTeclar(e, i));
  campo.addEventListener("paste", (e) => aoColar(e, i));

  coluna.append(rotulo, campo);
  el.colunas.append(coluna);
  campos.push(campo);
});

function marcar(campo) { campo.classList.toggle("preenchido", campo.value !== ""); }

function aoDigitar(i) {
  const campo = campos[i];
  const digitos = campo.value.replace(/\D/g, "");
  campo.value = digitos.slice(-1);             // só um algarismo (0-9); o último digitado vence
  marcar(campo);
  limparErro();
  if (campo.value && campos[i + 1]) campos[i + 1].focus();
}

function aoTeclar(e, i) {
  if (e.key === "Backspace" && campos[i].value === "" && i > 0) {
    e.preventDefault();                        // volta e apaga o anterior
    campos[i - 1].value = "";
    marcar(campos[i - 1]);
    campos[i - 1].focus();
  } else if (e.key === "ArrowLeft" && i > 0) {
    e.preventDefault(); campos[i - 1].focus();
  } else if (e.key === "ArrowRight" && i < campos.length - 1) {
    e.preventDefault(); campos[i + 1].focus();
  }
  // Enter envia o formulário (mesma ação do botão) sem código extra.
}

function aoColar(e, i) {
  e.preventDefault();
  const texto = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
  if (!texto) return;
  let ultimo = i;
  for (let k = 0; k < texto.length && i + k < campos.length; k++) {
    campos[i + k].value = texto[k];
    marcar(campos[i + k]);
    ultimo = i + k;
  }
  limparErro();
  campos[Math.min(ultimo + 1, campos.length - 1)].focus();
}

// ---------------------------------------------------------------------
// MENSAGENS
// ---------------------------------------------------------------------
let timerMensagem = null;
function mostrarMensagem(texto) {
  el.mensagem.textContent = texto;
  el.mensagem.classList.add("visivel");
  clearTimeout(timerMensagem);
  timerMensagem = setTimeout(() => el.mensagem.classList.remove("visivel"), 4000);
}
function limparErro() {
  el.colunas.classList.remove("recusado");
}
function recusar(texto) {
  mostrarMensagem(texto);
  el.colunas.classList.remove("recusado");
  void el.colunas.offsetWidth;                 // reinicia a animação
  el.colunas.classList.add("recusado");
}

// ---------------------------------------------------------------------
// VERIFICAÇÃO
// ---------------------------------------------------------------------
el.form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (navegando) return;

  const vazio = campos.findIndex((c) => c.value === "");
  if (vazio !== -1) {                          // nunca navega com campos vazios
    recusar(CONFIG.mensagemIncompleto);
    campos[vazio].focus();
    return;
  }

  const tentativa = campos.map((c) => c.value).join("");
  if (tentativa !== String(codigoCorreto)) {   // nunca navega com sequência errada
    recusar(CONFIG.mensagemErro);
    return;
  }

  acertou();
});

function acertou() {
  if (navegando) return;
  navegando = true;
  campos.forEach((c) => (c.disabled = true));
  el.botao.disabled = true;
  el.mensagem.classList.remove("visivel");
  disparar(1);                                 // uma última batida forte
  el.cena.classList.add("partindo");
  setTimeout(() => { window.location.href = paginaDestino; }, CONFIG.atrasoRedirecionamento);
}

// ---------------------------------------------------------------------
// ÁUDIO: loop contínuo, controle de som e detecção de batidas
// Caminho principal: Web Audio (loop sem emendas + análise em tempo real).
// Reserva: <audio> comum + lista de batidas (quando o navegador bloqueia a análise).
// ---------------------------------------------------------------------
const audio = {
  modo: null,             // "webaudio" | "elemento"
  ctx: null, ganho: null, analisador: null, fonte: null,
  elemento: null,
  mudo: false,
  pronto: false
};

async function prepararAudio() {
  const A = CONFIG.audio;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error("Web Audio indisponível");
    const ctx = new Ctx();
    const resposta = await fetch(A.arquivo);   // falha em file:// → cai na reserva
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const buffer = await ctx.decodeAudioData(await resposta.arrayBuffer());

    audio.ganho = ctx.createGain();
    audio.ganho.gain.value = audio.mudo ? 0 : A.volume;
    audio.analisador = ctx.createAnalyser();   // fica ANTES do ganho: o coração pulsa mesmo no mudo
    audio.analisador.fftSize = 1024;
    audio.analisador.smoothingTimeConstant = 0;

    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    fonte.loop = true;
    fonte.loopStart = A.loopInicio;
    fonte.loopEnd = Math.min(A.loopFim, buffer.duration);
    fonte.connect(audio.analisador);
    audio.analisador.connect(audio.ganho);
    audio.ganho.connect(ctx.destination);
    fonte.start(0, A.loopInicio);

    audio.ctx = ctx;
    audio.fonte = fonte;
    audio.modo = "webaudio";
    ctx.resume().catch(() => {});              // tenta tocar já; se bloqueado, espera a 1ª interação
  } catch (erro) {
    console.info("Usando o modo de reserva para o áudio:", erro.message || erro);
    const tag = new Audio(A.arquivo);
    tag.preload = "auto";
    tag.volume = A.volume;
    tag.muted = audio.mudo;
    tag.currentTime = 0;
    audio.elemento = tag;
    audio.modo = "elemento";
    tag.play().catch(() => {});                // bloqueado? tocará na 1ª interação
  }
  audio.pronto = true;
}

function destravarAudio() {
  if (!audio.pronto) return;
  if (audio.modo === "webaudio" && audio.ctx.state !== "running") {
    audio.ctx.resume().catch(() => {});
  } else if (audio.modo === "elemento" && audio.elemento.paused) {
    audio.elemento.play().catch(() => {});
  }
}

// Navegadores só liberam áudio depois de uma interação: qualquer uma destrava.
["pointerdown", "keydown", "touchend"].forEach((tipo) =>
  window.addEventListener(tipo, destravarAudio, { passive: true })
);

el.som.addEventListener("click", () => {
  audio.mudo = !audio.mudo;
  el.som.setAttribute("aria-pressed", String(audio.mudo));
  el.som.setAttribute("aria-label", audio.mudo ? "Ativar som" : "Desativar som");
  if (audio.modo === "webaudio") {
    audio.ganho.gain.setTargetAtTime(audio.mudo ? 0 : CONFIG.audio.volume, audio.ctx.currentTime, 0.04);
  } else if (audio.modo === "elemento") {
    audio.elemento.muted = audio.mudo;
  }
});

// ---------------------------------------------------------------------
// BATIDAS → PULSO
// ---------------------------------------------------------------------
function disparar(intensidade) {
  pulso = Math.max(pulso, intensidade);
}

const detector = {
  buffer: null, pico: 0, media: 0, ultima: -Infinity,
  indiceLista: 0, tempoAnterior: 0
};

function detectarPorAnalise(agora) {
  const an = audio.analisador;
  if (!detector.buffer) detector.buffer = new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(detector.buffer);

  let soma = 0;
  for (let i = 0; i < detector.buffer.length; i++) soma += detector.buffer[i] * detector.buffer[i];
  const nivel = Math.sqrt(soma / detector.buffer.length);

  detector.pico = Math.max(nivel, detector.pico * 0.9995);   // referência que desce devagar
  const limite = Math.max(detector.pico * CONFIG.audio.sensibilidade, 0.004);

  if (nivel > limite && nivel > detector.media * 1.5 &&
      agora - detector.ultima > CONFIG.audio.intervaloMinimoMs) {
    disparar(0.6 + 0.4 * Math.min(1, nivel / detector.pico));
    detector.ultima = agora;
  }
  detector.media += (nivel - detector.media) * 0.08;
}

function detectarPorLista() {
  const tag = audio.elemento;
  const A = CONFIG.audio;
  const t = tag.currentTime;

  // Loop manual dentro da janela (o <audio> comum não sabe repetir só um trecho)
  if (t >= A.loopFim) { tag.currentTime = A.loopInicio; detector.indiceLista = -1; return; }

  if (detector.indiceLista === -1 || t < detector.tempoAnterior - 0.2) {
    detector.indiceLista = A.batidas.findIndex((b) => b >= t);
    if (detector.indiceLista === -1) detector.indiceLista = A.batidas.length;
  }
  detector.tempoAnterior = t;

  while (detector.indiceLista < A.batidas.length && A.batidas[detector.indiceLista] <= t) {
    if (t - A.batidas[detector.indiceLista] < 0.15 && !tag.paused) disparar(1);
    detector.indiceLista++;
  }
}

let anterior = performance.now();
let ultimoValor = -1;
function quadro(agora) {
  const dt = Math.min(64, agora - anterior);
  anterior = agora;

  if (audio.modo === "webaudio" && audio.ctx.state === "running") detectarPorAnalise(agora);
  else if (audio.modo === "elemento") detectarPorLista();

  pulso *= Math.exp(-dt / CONFIG.pulso.decaimentoMs);
  if (pulso < 0.003) pulso = 0;

  if (Math.abs(pulso - ultimoValor) > 0.004) {
    document.documentElement.style.setProperty("--pulso", pulso.toFixed(3));
    ultimoValor = pulso;
  }
  requestAnimationFrame(quadro);
}

// ---------------------------------------------------------------------
// INÍCIO
// ---------------------------------------------------------------------
prepararAudio();
requestAnimationFrame(quadro);

// Em computadores, já deixa o cursor no primeiro campo (em celulares evita abrir o teclado sozinho)
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) campos[0].focus();
