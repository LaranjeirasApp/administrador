/**
 * Configurações do sistema — lê e escreve config/* no Firebase.
 * Escritas exigem conta admin (garantido pelas regras do banco).
 */

import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { escHtml } from "../utils.js";
import { icon, loading, errorBox, courtSvg, quadraAtiva, confirmDialog, ocupado } from "../ui.js";

export async function render(container, { db, showToast }) {
  container.innerHTML = `
    <div class="page" style="max-width:1080px">
      <header class="page-head">
        <div>
          <h1 class="page-title">Configurações</h1>
          <p class="page-desc">Parâmetros que valem para o app do morador e para o app do fiscal. As mudanças entram em vigor na hora.</p>
        </div>
      </header>
      <div id="conf-root">${loading()}</div>
    </div>`;

  let cfg;
  try {
    const snap = await get(ref(db, 'config'));
    cfg = snap.val() || {};
  } catch (err) {
    document.getElementById('conf-root').innerHTML = `<div class="panel">${errorBox(err)}</div>`;
    return null;
  }

  const limite = cfg.limiteDiarioGeral || null;
  const loc = cfg.localizacao || {};

  document.getElementById('conf-root').innerHTML = `
    <section class="setting-section">
      <div class="setting-intro">
        <h2>Funcionalidades</h2>
        <p>Liga e desliga recursos do app do morador sem precisar publicar uma nova versão.</p>
      </div>
      <div class="panel">
        ${toggleRow('conf-inscricoes', 'Inscrições pelo app', 'Moradores entram na fila pelo próprio celular. Desligado, só o fiscal inscreve.', cfg.inscricoesOnlineAtivas !== false)}
        ${toggleRow('conf-whatsapp', 'Aviso por WhatsApp', 'Mostra o convite para receber aviso no WhatsApp ao se inscrever.', cfg.whatsappAvisoAtivo !== false)}
        ${toggleRow('conf-gps', 'Check-in por localização', 'Mostra o botão de confirmar chegada pelo GPS do celular.', cfg.checkinGpsAtivo === true)}
      </div>
    </section>

    <section class="setting-section">
      <div class="setting-intro">
        <h2>Limite diário de inscrições</h2>
        <p>Quantas vezes cada unidade pode entrar na fila por dia. Unidades internas (quadra 99) nunca têm limite.</p>
      </div>
      <div class="panel panel-body" style="display:flex;flex-direction:column;gap:16px">
        <div class="choices" role="radiogroup" aria-label="Limite diário">
          <label class="choice">
            <input type="radio" name="conf-limite-tipo" value="sem" id="conf-limite-sem" ${!limite ? 'checked' : ''}>
            <span><span class="choice-title">Sem limite</span><span class="choice-desc" style="display:block">Cada unidade se inscreve quantas vezes quiser.</span></span>
          </label>
          <label class="choice">
            <input type="radio" name="conf-limite-tipo" value="com" id="conf-limite-com" ${limite ? 'checked' : ''}>
            <span><span class="choice-title">Limitar por dia</span><span class="choice-desc" style="display:block">Bloqueia novas inscrições ao atingir o máximo.</span></span>
          </label>
        </div>
        <div class="form-row">
          <div class="field">
            <label class="label" for="conf-limite-valor">Máximo por unidade</label>
            <div style="display:flex;align-items:center;gap:10px">
              <input id="conf-limite-valor" type="number" min="1" max="10" class="input input-num" value="${limite || 2}" ${!limite ? 'disabled' : ''}>
              <span class="hint">inscrições por dia</span>
            </div>
          </div>
          <span class="spacer"></span>
          <button id="conf-limite-save" class="btn btn-primary">Salvar limite</button>
        </div>
      </div>
    </section>

    <section class="setting-section">
      <div class="setting-intro">
        <h2>Quadras disponíveis</h2>
        <p>Quadras desativadas somem do formulário de inscrição e aparecem hachuradas nas telas de acompanhamento.</p>
      </div>
      <div class="panel">
        ${[1, 2, 3, 4, 5].map(n => courtRow(n, cfg.quadras?.[n]?.nome || `Quadra ${n}`, quadraAtiva(cfg.quadras, n))).join('')}
      </div>
    </section>

    <section class="setting-section">
      <div class="setting-intro">
        <h2>Localização das quadras</h2>
        <p>Ponto central usado no check-in por localização. Quem estiver dentro do raio consegue confirmar a chegada.</p>
      </div>
      <div class="panel panel-body" style="display:flex;flex-direction:column;gap:16px">
        <div class="form-grid">
          <div class="field">
            <label class="label" for="conf-lat">Latitude</label>
            <input id="conf-lat" type="number" step="0.000001" class="input num" value="${escHtml(loc.lat ?? '')}" placeholder="-23.000000">
          </div>
          <div class="field">
            <label class="label" for="conf-lng">Longitude</label>
            <input id="conf-lng" type="number" step="0.000001" class="input num" value="${escHtml(loc.lng ?? '')}" placeholder="-46.000000">
          </div>
          <div class="field">
            <label class="label" for="conf-raio">Raio em metros</label>
            <input id="conf-raio" type="number" min="10" max="500" class="input num" value="${escHtml(loc.raioMetros || 100)}">
          </div>
        </div>
        <div class="form-row">
          <a id="conf-mapa" class="panel-link" target="_blank" rel="noopener" ${loc.lat != null && loc.lng != null ? '' : 'hidden'}
            href="https://www.google.com/maps?q=${encodeURIComponent(loc.lat)},${encodeURIComponent(loc.lng)}">${icon('pin', 15)}Conferir no mapa ${icon('external', 13)}</a>
          <span class="spacer"></span>
          <button id="conf-loc-save" class="btn btn-primary">Salvar localização</button>
        </div>
      </div>
    </section>`;

  const $ = id => document.getElementById(id);

  async function setConfig(path, value, okMsg = 'Configuração salva.') {
    try {
      await set(ref(db, path), value);
      showToast?.(okMsg, 'ok');
      return true;
    } catch (err) {
      showToast?.('Erro: ' + err.message, 'err');
      return false;
    }
  }

  /**
   * Interruptor: trava enquanto grava e volta atrás se der erro. `aoDesligar`
   * (opcional) pede confirmação antes de desligar algo que afeta os moradores.
   */
  async function toggle(el, path, { aoDesligar, okMsg } = {}) {
    const valor = el.checked;
    if (!valor && aoDesligar) {
      const ok = await confirmDialog({ ...aoDesligar, tone: 'danger' });
      if (!ok) { el.checked = true; return false; }
    }
    el.disabled = true;
    const ok = await setConfig(path, valor, okMsg?.(valor));
    el.disabled = false;
    if (!ok) el.checked = !valor;
    el.focus({ preventScroll: true });
    return ok;
  }

  $('conf-whatsapp').addEventListener('change', e => toggle(e.target, 'config/whatsappAvisoAtivo'));
  $('conf-inscricoes').addEventListener('change', e => toggle(e.target, 'config/inscricoesOnlineAtivas', {
    aoDesligar: {
      title: 'Desligar as inscrições pelo app?',
      message: 'Os moradores deixam de conseguir entrar na fila pelo celular até você ligar de novo.\nSó o fiscal poderá inscrever.',
      confirmLabel: 'Desligar inscrições',
    },
    okMsg: v => v ? 'Inscrições pelo app ligadas.' : 'Inscrições pelo app desligadas.',
  }));
  $('conf-gps').addEventListener('change', e => toggle(e.target, 'config/checkinGpsAtivo'));

  [1, 2, 3, 4, 5].forEach(n => {
    $(`conf-quadra-${n}`).addEventListener('change', async e => {
      const ok = await toggle(e.target, `config/quadras/${n}/ativa`, {
        aoDesligar: {
          title: `Desativar a Quadra ${n}?`,
          message: 'Ela some do formulário de inscrição dos moradores até você ativar de novo.',
          confirmLabel: 'Desativar quadra',
        },
        okMsg: v => v ? `Quadra ${n} ativada.` : `Quadra ${n} desativada.`,
      });
      if (!ok) return;
      const ativa = e.target.checked;
      const row = $(`conf-tile-${n}`);
      row.classList.toggle('is-off', !ativa);
      row.querySelector('.court-row-state').textContent = estadoTexto(ativa);
    });
  });

  document.querySelectorAll('input[name="conf-limite-tipo"]').forEach(radio => {
    radio.addEventListener('change', () => {
      $('conf-limite-valor').disabled = $('conf-limite-sem').checked;
    });
  });
  $('conf-limite-save').addEventListener('click', async e => {
    const semLimite = $('conf-limite-sem').checked;
    const valor = semLimite ? null : Number($('conf-limite-valor').value) || 2;
    const soltar = ocupado(e.currentTarget);
    await setConfig('config/limiteDiarioGeral', valor, semLimite ? 'Limite removido.' : `Limite de ${valor} por dia salvo.`);
    soltar();
  });

  $('conf-loc-save').addEventListener('click', async e => {
    const lat = parseFloat($('conf-lat').value);
    const lng = parseFloat($('conf-lng').value);
    const raioMetros = parseInt($('conf-raio').value, 10);
    if (isNaN(lat) || isNaN(lng)) {
      showToast?.('Informe latitude e longitude.', 'err');
      return;
    }
    const soltar = ocupado(e.currentTarget);
    const ok = await setConfig('config/localizacao', { lat, lng, raioMetros: raioMetros || 100 }, 'Localização salva.');
    soltar();
    if (ok) {
      const a = $('conf-mapa');
      a.href = `https://www.google.com/maps?q=${lat},${lng}`;
      a.hidden = false;
    }
  });

  return null;
}

// ── Helpers ──────────────────────────────────────────────

function toggleRow(id, label, desc, checked) {
  return `
    <div class="row-toggle">
      <div>
        <div class="row-title">${escHtml(label)}</div>
        <div class="row-desc">${escHtml(desc)}</div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} aria-label="${escHtml(label)}">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
}

function estadoTexto(ativa) {
  return ativa ? 'Ativa · aparece no formulário de inscrição' : 'Desativada';
}

function courtRow(n, nome, ativa) {
  return `
    <div class="row-toggle court-row${ativa ? '' : ' is-off'}" id="conf-tile-${n}">
      <div class="court-row-info">
        <span class="court-mini">${courtSvg()}</span>
        <div>
          <div class="row-title">${escHtml(nome)}</div>
          <div class="row-desc court-row-state">${estadoTexto(ativa)}</div>
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="conf-quadra-${n}" ${ativa ? 'checked' : ''} aria-label="${escHtml(nome)} ativa">
        <span class="toggle-slider"></span>
      </label>
    </div>`;
}
