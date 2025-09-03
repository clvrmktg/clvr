(function () {
  const form = document.getElementById('wizard');
  if (!form) return;

  const $ = sel => form.querySelector(sel);
  const $$ = sel => Array.from(form.querySelectorAll(sel));

  const listEl = $('#summaryList');
  const oneTimeEl = $('#oneTimeTotal');
  const monthlyEl = $('#monthlyTotal');
  const summaryField = $('#estimateSummary');

  const money = n => '$' + Number(n).toLocaleString('en-US');

  function labelFor(input) {
    // 1) explicit override if you ever want it
    if (input.dataset.summaryLabel) {
      return input.dataset.summaryLabel.trim();
    }
  
    // 2) associated <label for="…">
    let lab = form.querySelector(`label[for="${input.id}"]`);
    if (lab) {
      const t = lab.querySelector('.title');
      return (t ? t.textContent : lab.childNodes[0]?.textContent || lab.textContent)
        .trim()
        .replace(/\s+/g, ' ');
    }
  
    // 3) wrapped <label> (your radio cards use this)
    const wrap = input.closest('label');
    if (wrap) {
      const t = wrap.querySelector('.title');
      if (t) return t.textContent.trim().replace(/\s+/g, ' ');
  
      // Fallback: strip non-title bits (price, tagline, etc.)
      const clone = wrap.cloneNode(true);
      clone.querySelectorAll('.price,.tagline,.desc,.eyebrow,small,[aria-hidden="true"]')
        .forEach(el => el.remove());
      return clone.textContent.trim().replace(/\s+/g, ' ');
    }
  
    // 4) last resort
    return input.name;
  }
  
  
  
  function selections() {
    // 1) normal checked radios + checkboxes
    const checked = $$('input[type="radio"]:checked, input[type="checkbox"]:checked');
  
    // 2) explicitly add locked "included" items (whether :checked fires or not)
    const locked = $$('.choice[data-locked] input[type="checkbox"], .choice[data-locked="true"] input[type="checkbox"]');
  
    // merge + dedupe by element id
    const seen = new Set();
    const chosen = [...checked, ...locked].filter(el => {
      if (!el || seen.has(el.id)) return false;
      seen.add(el.id);
      return true;
    });
  
    const lines = [];
    let oneTime = 0, monthly = 0;
  
    chosen.forEach(input => {
      if (input.name === 'step') return; // ignore wizard nav
  
      const label = labelFor(input);
  
      const hasOneTime = input.hasAttribute('data-price');
      const p = hasOneTime ? Number(input.dataset.price || 0) : null;
  
      const hasMonthly = input.hasAttribute('data-recurring');
      const m = hasMonthly ? Number(input.dataset.recurring || 0) : null;
  
      // Include any item that declares data-price, even if it's 0 (shows as "Included")
      if (hasOneTime) {
        if (p > 0) oneTime += p;
        lines.push({ label, price: p, recurring: false });
      }
      // Radios without data-price still get shown for clarity
      else if (input.type === 'radio') {
        lines.push({ label, price: 0, recurring: false });
      }
  
      if (hasMonthly) {
        monthly += m;
        lines.push({ label: label + ' (monthly)', price: m, recurring: true });
      }
    });
  
    return { lines, oneTime, monthly };
  }
  
  
  function render() {
    const { lines, oneTime, monthly } = selections();

    // list
    listEl.innerHTML = lines.map(l => {
      // when building price strings
      const price = l.recurring ? `${money(l.price)}/mo` : (l.price ? money(l.price) : 'Included');

      const amtClass = price === 'Included' ? 'amount amount--included' : 'amount';
      return `<li class="[ summary__item ][ flex between middle py--0.5 ]"><span class="label">${l.label}</span><span class="${amtClass}">${price}</span></li>`;
      
    }).join('') || '<li class="[ summary__item ][ flex between middle py--0.5 ]"><span>No add-ons selected.</span></li>';

    // totals
    oneTimeEl.textContent = money(oneTime);

    const monthlyRow = document.getElementById('monthlyRow');
    if (monthly > 0) {
      monthlyEl.textContent = money(monthly) + '/mo';
      monthlyRow.hidden = false;
    } else {
      monthlyRow.hidden = true;           // hide the row when $0
    }

    // hidden plain-text summary for emails
    summaryField.value = [
      'Estimate Summary',
      '----------------',
      ...lines.map(l => {
        // when building price strings
        const price = l.recurring ? `${money(l.price)}/mo` : (l.price ? money(l.price) : 'Included');
        return `${price}  - ${l.label}`;
      }),
      '----------------',
      `One-time total: ${money(oneTime)}`,
      `Monthly total: ${monthly ? money(monthly) + '/mo' : '$0'}`
    ].join('\n');
  }

  // Recalc on any change
  form.addEventListener('change', render);


  // Recalc whenever the step changes (so landing on Review is always fresh)
  $$('input[name="step"]').forEach(r => r.addEventListener('change', render));

  // Initial render in case Step 6 is preselected (unlikely)
  render();
})();
