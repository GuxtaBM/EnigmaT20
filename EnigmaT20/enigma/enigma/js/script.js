/* =====================================================================
   ENIGMA — SCRIPT
   Tudo que você costuma editar está em CONFIG, logo abaixo.
   ===================================================================== */

// ---------------------------------------------------------------------
// CONFIGURAÇÕES DO ENIGMA
// ---------------------------------------------------------------------
const CONFIG = {
  // Textos. Deixe null para usar o que está escrito no index.html.
  // Se preencher aqui, o valor substitui o do HTML.
  textoPrincipal: null,          // ex.: "Palavra palavra"
  textoSecreto:   null,          // ex.: "Texto texto texto texto"
  mensagemSucesso: null,         // ex.: "Paraiso"  (null = usa o texto do HTML)

  // A resposta que abre o enigma. Só existe aqui, nunca no HTML.
  palavraSecreta: "Decifre, ilumine, retorne",
  ignorarAcentos: true,          // "Paraíso" e "paraiso" contam como iguais
  // (espaços nas pontas e maiúsculas/minúsculas são sempre ignorados)

  // Para onde a passagem secreta leva
  paginaDestino: "segredo.html",

  // Mensagens discretas
  mensagemErro:  "Os olhos observam seu erro...",
  mensagemVazio: "O silencio não é uma opção...",

  // Som de sucesso (toca uma única vez, ao acertar)
  audio: "assets/audio/skill-check-dbd.mp3",
  volume: 0.8,                   // 0 a 1

  // Ícones (arquivos em assets/icons/)
  icones: {
    cadeadoTrancado: "assets/icons/icons8-cadeado-100.png",
    cadeadoAberto:   "assets/icons/icons8-unlock-100.png",
    olhoFechado:     "assets/icons/icons8-closed-eye-50.png",
    olhoAberto:      "assets/icons/icons8-eye-50.png"
  },

  // Comportamento dos olhos
  olhos: {
    suavizacao: 0.10,            // 0.03 = lento e pesado · 0.3 = ágil
    deslocamentoMax: 0.15,       // quanto a íris pode andar, como fração da largura do olho
    alcance: 1.0,                // distância (em larguras de olho) para o olhar "encostar" no limite
    ociosoMs: 2500               // sem mexer o mouse/dedo por este tempo: os olhos passeiam sozinhos
  },

  // Tempos da sequência de desbloqueio (ms)
  tempos: {
    campoSome: 700,
    mensagemAparece: 500,
    acessoAparece: 1900
  }
};

// ---------------------------------------------------------------------
// ESTADO
// ---------------------------------------------------------------------
let desbloqueado = false;        // independente da interface: garante que o sucesso roda uma vez só

// ---------------------------------------------------------------------
// ELEMENTOS
// ---------------------------------------------------------------------
const $ = (id) => document.getElementById(id);

const el = {
  principal:   $("texto-principal"),
  secreto:     $("texto-secreto"),
  cadeado:     $("cadeado"),
  cadeadoImg:  $("cadeado-img"),
  form:        $("resposta"),
  campo:       $("resposta-campo"),
  erro:        $("erro"),
  sucesso:     $("sucesso"),
  acesso:      $("acesso"),
  acessoFechado: $("acesso-fechado"),
  acessoAberto:  $("acesso-aberto")
};

const prefereMenosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------------------------------------------------------------------
// INICIALIZAÇÃO DE TEXTOS E ÍCONES
// ---------------------------------------------------------------------
if (CONFIG.textoPrincipal)  el.principal.textContent = CONFIG.textoPrincipal;
if (CONFIG.textoSecreto)    el.secreto.textContent   = CONFIG.textoSecreto;
if (CONFIG.mensagemSucesso) el.sucesso.textContent   = CONFIG.mensagemSucesso;

/** Define o src de um ícone; se o arquivo não existir, mostra um rótulo discreto no lugar. */
function carregarIcone(img, caminho) {
  const caixa = img.parentElement;
  img.addEventListener("error", () => caixa.classList.add("sem-icone"));
  img.addEventListener("load",  () => caixa.classList.remove("sem-icone"));
  img.src = caminho;
}

carregarIcone(el.cadeadoImg,    CONFIG.icones.cadeadoTrancado);
carregarIcone(el.acessoFechado, CONFIG.icones.olhoFechado);
carregarIcone(el.acessoAberto,  CONFIG.icones.olhoAberto);

// Dificulta a cópia casual do texto secreto (a seleção já é bloqueada no CSS)
["copy", "cut", "dragstart", "selectstart", "contextmenu"].forEach((ev) =>
  el.secreto.addEventListener(ev, (e) => e.preventDefault())
);

// ---------------------------------------------------------------------
// OLHOS
// A direção é calculada aqui; o CSS aplica o movimento via --ix e --iy.
// ---------------------------------------------------------------------
const olhos = Array.from(document.querySelectorAll("[data-olho]")).map((raiz) => ({
  raiz,
  iris: raiz.querySelector(".olho__iris"),
  x: 0, y: 0                     // deslocamento atual (px)
}));

const mira = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let ultimoMovimento = -Infinity; // nunca mexeu: começa em modo "passeio" (ideal para toque)
let animando = false;
let tAnterior = 0;

function pontoOciosoVirtual(t) {
  // Um ponto fictício que passeia pela tela, para os olhos "vigiarem" quando ninguém move o cursor
  const w = window.innerWidth, h = window.innerHeight;
  return {
    x: w * (0.5 + 0.38 * Math.sin(t / 2300) * Math.cos(t / 5200)),
    y: h * (0.5 + 0.32 * Math.sin(t / 3100 + 1.3))
  };
}

function quadro(agora) {
  const dt = Math.min(50, agora - (tAnterior || agora));
  tAnterior = agora;

  const ocioso = !prefereMenosMovimento && agora - ultimoMovimento > CONFIG.olhos.ociosoMs;
  const alvoGlobal = ocioso ? pontoOciosoVirtual(agora) : mira;

  // Interpolação independente da taxa de quadros
  const k = 1 - Math.pow(1 - CONFIG.olhos.suavizacao, dt / 16.667);
  let emRepouso = true;

  for (const olho of olhos) {
    const r = olho.raiz.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = alvoGlobal.x - cx;
    const dy = alvoGlobal.y - cy;
    const dist = Math.hypot(dx, dy);

    // tanh: a íris acompanha de perto quando o cursor está perto e satura suavemente no limite
    const maximo = r.width * CONFIG.olhos.deslocamentoMax;
    const intensidade = dist > 0 ? Math.tanh(dist / (r.width * CONFIG.olhos.alcance)) : 0;
    const alvoX = dist > 0 ? (dx / dist) * maximo * intensidade : 0;
    const alvoY = dist > 0 ? (dy / dist) * maximo * intensidade : 0;

    olho.x += (alvoX - olho.x) * k;
    olho.y += (alvoY - olho.y) * k;

    olho.iris.style.setProperty("--ix", olho.x.toFixed(2) + "px");
    olho.iris.style.setProperty("--iy", olho.y.toFixed(2) + "px");

    if (Math.abs(alvoX - olho.x) > 0.05 || Math.abs(alvoY - olho.y) > 0.05) emRepouso = false;
  }

  // Sem nada para animar (cursor parado e olhos já alinhados) → pausa o loop
  if (emRepouso && !ocioso) { animando = false; tAnterior = 0; return; }
  requestAnimationFrame(quadro);
}

function iniciarOlhos() {
  if (animando) return;
  animando = true;
  requestAnimationFrame(quadro);
}

function aoMoverPonteiro(e) {
  mira.x = e.clientX;
  mira.y = e.clientY;
  ultimoMovimento = performance.now();
  iniciarOlhos();
}

// Pointer Events cobrem mouse, caneta e toque (enquanto o dedo arrasta).
window.addEventListener("pointermove", aoMoverPonteiro, { passive: true });
window.addEventListener("pointerdown", aoMoverPonteiro, { passive: true });
window.addEventListener("resize", iniciarOlhos);
iniciarOlhos();

// ---------------------------------------------------------------------
// RESPOSTA
// ---------------------------------------------------------------------
function normalizar(texto) {
  let t = String(texto).trim().toLowerCase();
  if (CONFIG.ignorarAcentos) t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return t;
}

let timerErro = null;
function mostrarErro(mensagem) {
  el.erro.textContent = mensagem;
  el.erro.classList.add("visivel");
  el.form.classList.remove("recusada");
  void el.form.offsetWidth;                       // reinicia a animação
  if (!prefereMenosMovimento) el.form.classList.add("recusada");
  clearTimeout(timerErro);
  timerErro = setTimeout(() => el.erro.classList.remove("visivel"), 3500);
}

el.form.addEventListener("submit", (e) => {
  e.preventDefault();                              // nunca recarrega a página
  if (desbloqueado) return;

  const resposta = normalizar(el.campo.value);
  if (!resposta) return mostrarErro(CONFIG.mensagemVazio);

  if (resposta === normalizar(CONFIG.palavraSecreta)) {
    desbloquear();
  } else {
    mostrarErro(CONFIG.mensagemErro);
    el.campo.select();
  }
});

// ---------------------------------------------------------------------
// DESBLOQUEIO (executa uma única vez)
// ---------------------------------------------------------------------
function desbloquear() {
  if (desbloqueado) return;
  desbloqueado = true;

  el.campo.disabled = true;
  el.form.querySelector("button").disabled = true;

  tocarSom();
  abrirCadeado();

  // 1) o campo se dissolve
  el.form.classList.add("some");
  el.erro.classList.remove("visivel");
  setTimeout(() => { el.form.hidden = true; el.erro.hidden = true; }, CONFIG.tempos.campoSome);

  // 2) a mensagem surge no lugar dele
  setTimeout(() => {
    el.sucesso.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.sucesso.classList.add("revelado")));
  }, CONFIG.tempos.campoSome + CONFIG.tempos.mensagemAparece - 200);

  // 3) por último, a passagem secreta
  setTimeout(revelarAcesso, CONFIG.tempos.acessoAparece + CONFIG.tempos.campoSome);
}

function tocarSom() {
  if (!CONFIG.audio) return;
  try {
    const som = new Audio(CONFIG.audio);
    som.volume = Math.min(1, Math.max(0, CONFIG.volume));
    const promessa = som.play();                    // chamado dentro do envio do usuário: permitido pelos navegadores
    if (promessa && typeof promessa.catch === "function") {
      promessa.catch((erro) => console.warn("Não foi possível tocar o áudio:", erro));
    }
  } catch (erro) {
    console.warn("Não foi possível tocar o áudio:", erro);
  }
}

function abrirCadeado() {
  el.cadeado.classList.add("trocando");
  setTimeout(() => {
    carregarIcone(el.cadeadoImg, CONFIG.icones.cadeadoAberto);
    el.cadeadoImg.alt = "Destrancado";
    el.cadeado.dataset.rotulo = "aberto";
    el.cadeado.classList.remove("trocando");
    el.cadeado.classList.add("aberto");
  }, 350);
}

function revelarAcesso() {
  // O destino só é colocado no link agora; antes disso o elemento nem tem href.
  el.acesso.href = CONFIG.paginaDestino;
  el.acesso.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => el.acesso.classList.add("revelado")));
}
