(() => {
  const $ = selector => document.querySelector(selector);
  const currency = n => n.toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
  const percent = n => n.toLocaleString('pt-BR',{maximumFractionDigits:1}) + '%';
  const samples = {balcao:'3', delivery:'23'};
  let mode = 'balcao';
  const fields = ['preco','custo','taxa','cupom'];
  function calculate() {
    const vals = fields.map(key => {
      const v = $('#'+key).value.trim();
      return /^\d+(?:[.,]\d{1,2})?$/.test(v) ? Number(v.replace(',','.')) : NaN;
    });
    const [price,cost,rate,discount] = vals;
    const valid = vals.every(Number.isFinite) && price > discount && rate <= 100;
    const net = price-discount;
    const leftover = net*(1-rate/100)-cost;
    $('#sobra').textContent = valid ? currency(leftover) : '—';
    $('#margem').textContent = valid ? 'Margem de '+percent(leftover/net*100) : '';
    $('#aviso').textContent = valid ? 'Taxa aplicada ao valor após o desconto.' : 'Informe valores positivos ou zero, taxa de até 100% e preço maior que o desconto.';
    samples[mode] = $('#taxa').value;
  }
  fields.forEach(k => $('#'+k).addEventListener('input',calculate));
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    mode = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));
    $('#taxa').value = samples[mode]; calculate();
  });
  calculate();
  const modal = $('#modal'), content = $('#modalContent');
  let seen = false, spinning = 0, lastFocus;
  try { seen = sessionStorage.getItem('hl-exit')==='1'; } catch {}
  function show(html) {
    if(!modal.open) lastFocus = document.activeElement;
    content.innerHTML = '<div class="modalBody">'+html+'</div>';
    if(!modal.open) modal.showModal();
    $('.close').focus();
  }
  modal.addEventListener('close',()=>{
    clearTimeout(spinning);
    if(lastFocus && lastFocus.isConnected) lastFocus.focus({preventScroll:true});
  });
  $('.close').onclick = () => modal.close();
  modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();}});
  const prices = {basico:'10,00',premium:'27,00',promocao:'19,90'};
  function buy(plan) {
    const url = window.CHECKOUT?.[plan] || '';
    if(/^https:\/\//i.test(url)){window.location.assign(url);return;}
    show('<p class="eyebrow">Prévia de compra</p><h2 id="mt">'+(plan==='basico'?'BÁSICO':'PREMIUM')+' · R$ '+prices[plan]+'</h2><p>O checkout deste plano ainda não foi conectado. Nenhum pagamento foi iniciado.</p><button class="btn mainBtn" data-close>Voltar à página</button>');
  }
  $('#basic').onclick=()=>show('<p class="eyebrow">Oferta no plano Básico</p><h2 id="mt">LEVE O <em>PREMIUM.</em></h2><p>Por mais R$ 9,90, troque a ficha manual pela planilha automática com aulas, estoque e todos os bônus.</p><p><del>R$ 27,00</del> &nbsp; <b>R$ 19,90 · pagamento único</b></p><button class="btn mainBtn" data-buy="promocao">Quero o Premium por R$ 19,90 ↗</button><button class="textLink" data-buy="basico">Continuar com o Básico por R$ 10,00</button>');
  function wheel() {
    if (modal.open) return;
    seen = true;
    try { sessionStorage.setItem('hl-exit','1'); } catch {}

    show(`
      <p class="eyebrow">Desconto garantido</p>
      <h2 id="mt">GIRE A ROLETA.</h2>
      <p class="wheel-intro">Todo giro libera o Premium por R$ 19,90 com os três bônus da roleta.</p>
      <div class="wheelbox">
        <div class="wheel" role="img" aria-label="Premium por R$ 19,90 com artes para Canva, controle de estoque e cardápio de montagem.">
          <span class="sector offer"><small>Premium</small><b>R$ 19,90</b></span>
          <span class="sector right"><b>330+ artes</b><small>para Canva</small></span>
          <span class="sector bottom"><b>Controle</b><small>de estoque</small></span>
          <span class="sector left"><b>Cardápio</b><small>de montagem</small></span>
        </div>
      </div>
      <p class="wheel-result" role="status"></p>
      <button class="btn mainBtn" id="spin">Girar e liberar oferta</button>
      <button class="btn mainBtn" id="redeem" data-buy="promocao" hidden>Usar meu desconto ↗</button>
      <button class="textLink" data-close hidden>Continuar na página</button>
    `);
    const spin = $('#spin');
    spin.onclick = () => {
      spin.disabled = true;
      spin.textContent = 'Girando…';
      $('.wheel').classList.add('spin');
      spinning = setTimeout(() => {
        $('#mt').textContent = 'PRÊMIO LIBERADO!';
        $('.wheel-intro').hidden = true;
        $('.wheel-result').textContent = 'Premium completo por R$ 19,90. Você economiza R$ 7,10.';
        spin.hidden = true;
        $('#redeem').hidden = false;
        content.querySelector('[data-close]').hidden = false;
        $('#redeem').focus({preventScroll:true});
      }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2050);
    };
  }
  $('#gift').onclick=wheel;
  const start=Date.now();
  document.addEventListener('mouseout',e=>{
    if(!seen && !e.relatedTarget && e.clientY<=5 && Date.now()-start>1800 && matchMedia('(hover:hover) and (pointer:fine)').matches) wheel();
  });
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-buy],[data-close]');
    if(!button)return;
    if(button.dataset.buy)buy(button.dataset.buy);else modal.close();
  });
})();
