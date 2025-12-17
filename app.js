const state = {
  expenses: [],
  planned: [],
  initialized: false,
  editing: null,
  balance: 0
}
function money(v) {
  return `DH ${Number(v).toFixed(2)}`
}
function todayISO() {
  const d = new Date()
  d.setHours(0,0,0,0)
  return d.toISOString().slice(0,10)
}
function yesterdayISO() {
  const d = new Date()
  d.setDate(d.getDate()-1)
  d.setHours(0,0,0,0)
  return d.toISOString().slice(0,10)
}
function parseChunks(text) {
  return text.split(/[,;]| and | or /i).map(s=>s.trim()).filter(Boolean)
}
function normalizeTypos(s) {
  return s
    .replace(/\bbusyging\b/g, 'buying')
    .replace(/\bbuygin\b/g, 'buying')
    .replace(/\bbuing\b/g, 'buying')
    .replace(/\bgorsheries\b/g, 'groceries')
    .replace(/\bgorceries\b/g, 'groceries')
    .replace(/\bgrocceries\b/g, 'groceries')
    .replace(/\bcoffe\b/g, 'coffee')
    .replace(/\bsnaks\b/g, 'snacks')
    .replace(/\btaxy\b/g, 'taxi')
    .replace(/\binernet\b/g, 'internet')
    .replace(/\bslat\b/g, 'salt')
}
function normalizeText(s) {
  return normalizeCurrency(normalizeTypos(s.toLowerCase()))
}
function normalizeCurrency(s) {
  return s.replace(/\$/g,' dirham ')
}
function extractAmount(s) {
  const m1 = s.match(/(\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed|درهم|د\.?م\.?)\b/i)
  if (m1) return parseFloat(m1[1])
  const m2 = s.match(/\b(?:usd|dollar|dollars|dirham|dh|mad|aed|درهم|د\.?م\.?)\s*(\d+(?:\.\d+)?)\b/i)
  if (m2) return parseFloat(m2[1])
  const hasVerb = /\b(spent|pay|paid|cost|price|using|use)\b/i.test(s)
  if (hasVerb) {
    const dates = [...s.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0])
    const nums = [...s.matchAll(/\b\d+(?:\.\d+)?\b/g)].map(m=>m[0])
    const filtered = nums.filter(n=>!dates.some(d=>d.includes(n)))
    if (filtered.length) return parseFloat(filtered[0])
  }
  return null
}
function cleanCategory(x) {
  let s = (x || '').trim()
  s = s.replace(/^(the|a|my)\s+/i, '')
  s = s.replace(/\s+(to|at|in|with|for|on)\b.*$/i, '')
  s = s.replace(/[^a-z \-]/gi, '')
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts.length > 2) s = parts.slice(0,2).join(' ')
  return s || 'uncategorized'
}
function extractCategory(s) {
  const a = s.match(/\bbuy(?:ing)?\s+([a-z \-]+)/i)
  if (a) return cleanCategory(a[1])
  const b = s.match(/\bbought\s+([a-z \-]+)/i)
  if (b) return cleanCategory(b[1])
  const c = s.match(/\bpurchas(?:e|ing)\s+([a-z \-]+)/i)
  if (c) return cleanCategory(c[1])
  const d = s.match(/\bon\s+([a-z \-]+)/i)
  if (d) return cleanCategory(d[1])
  const di = s.match(/\bin\s+([a-z \-]+)/i)
  if (di) return cleanCategory(di[1])
  const da = s.match(/\bat\s+([a-z \-]+)/i)
  if (da) return cleanCategory(da[1])
  const dt = s.match(/\bto\s+([a-z \-]+)/i)
  if (dt) return cleanCategory(dt[1])
  const e = s.match(/\bfor\s+([a-z \-]+)/i)
  if (e) return cleanCategory(e[1])
  const f = s.match(/\busing\s+([a-z \-]+)/i)
  if (f) return cleanCategory(f[1])
  const g = s.match(/\bpaid\s+(?:for\s+)?([a-z \-]+)/i)
  if (g) return cleanCategory(g[1])
  const h = s.match(/\bspent\s+(?:\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed)\s+on\s+([a-z \-]+)/i)
  if (h) return cleanCategory(h[1])
  const pre = s.match(/\b([a-z \-]+)\s+(?:cost|price|worth)\s+\d/i)
  if (pre) return cleanCategory(pre[1])
  const mapping = {
    groceries: ['groceries','grocery','supermarket','market','food'],
    salt: ['salt'],
    taxi: ['taxi','uber','cab','ride','transport','bus','train'],
    internet: ['internet','wifi','data','bundle','subscription'],
    coffee: ['coffee','cafe'],
    snacks: ['snack','snacks'],
    rent: ['rent'],
    fuel: ['fuel','petrol','gas'],
    electricity: ['electricity','power'],
    water: ['water'],
    phone: ['phone','balance','airtime','credit'],
    restaurant: ['restaurant','dinner','lunch','meal','breakfast'],
    eggs: ['eggs','egg']
  }
  const lower = s.toLowerCase()
  for (const k of Object.keys(mapping)) {
    for (const w of mapping[k]) {
      const re = new RegExp(`\\b${w}\\b`, 'i')
      if (re.test(lower)) return k
    }
  }
  const tokens = lower.split(/\s+/).filter(t=>t && !/^\d+(\.\d+)?$/.test(t))
  const stop = new Set(['today','yesterday','tomorrow','spent','dirham','dh','mad','aed','dollar','dollars','usd','on','for','using','buying','bought','purchase','purchasing','paid'])
  const filtered = tokens.filter(t=>!stop.has(t))
  if (filtered.length) return cleanCategory(filtered[filtered.length-1])
  return 'uncategorized'
}
function extractDate(s) {
  if (/\btoday\b/i.test(s)) return todayISO()
  if (/\byesterday\b/i.test(s)) return yesterdayISO()
  if (/\btomorrow\b/i.test(s)) {
    const d = new Date()
    d.setDate(d.getDate()+1)
    d.setHours(0,0,0,0)
    return d.toISOString().slice(0,10)
  }
  const ex = s.match(/\b(\d{4}-\d{2}-\d{2})\b/)
  if (ex) return ex[1]
  return todayISO()
}
function parseInput(text) {
  const chunks = parseChunks(normalizeText(text))
  const items = []
  for (const ch of chunks) {
    const amount = extractAmount(ch)
    if (amount == null) continue
    const category = extractCategory(ch)
    const date = extractDate(ch)
    items.push({date, category, amount})
  }
  return items
}
function addExpenses(items) {
  const today = new Date(todayISO())
  for (const it of items) {
    const d = new Date(it.date)
    if (d > today) state.planned.push(it)
    else state.expenses.push(it)
  }
  persist()
  renderTable()
}
function persist() {
  try { localStorage.setItem('depences_expenses', JSON.stringify(state.expenses)) } catch {}
  try { localStorage.setItem('depences_planned', JSON.stringify(state.planned)) } catch {}
  try { localStorage.setItem('depences_balance', JSON.stringify(state.balance)) } catch {}
}
function load() {
  if (state.initialized) return
  state.initialized = true
  try {
    const raw = localStorage.getItem('depences_expenses')
    if (raw) state.expenses = JSON.parse(raw) || []
  } catch {}
  try {
    const raw2 = localStorage.getItem('depences_planned')
    if (raw2) state.planned = JSON.parse(raw2) || []
  } catch {}
  try {
    const raw3 = localStorage.getItem('depences_balance')
    if (raw3) state.balance = JSON.parse(raw3) || 0
  } catch {}
  renderTable()
}
function renderTable() {
  const tbody = document.querySelector('#expenses-table tbody')
  tbody.innerHTML = ''
  state.expenses.forEach((e, idx) => {
    const tr = document.createElement('tr')
    if (state.editing && state.editing.type==='expenses' && state.editing.idx===idx) {
      const tdDate = document.createElement('td')
      const inpDate = document.createElement('input')
      inpDate.type = 'date'
      inpDate.value = e.date
      tdDate.appendChild(inpDate)
      const tdCat = document.createElement('td')
      const inpCat = document.createElement('input')
      inpCat.type = 'text'
      inpCat.value = e.category
      tdCat.appendChild(inpCat)
      const tdAmt = document.createElement('td')
      const inpAmt = document.createElement('input')
      inpAmt.type = 'number'
      inpAmt.step = '0.01'
      inpAmt.value = e.amount
      tdAmt.appendChild(inpAmt)
      const tdAct = document.createElement('td')
      const save = document.createElement('button')
      save.textContent = 'Save'
      save.addEventListener('click', ()=> saveEdit('expenses', idx, {date: inpDate.value, category: inpCat.value, amount: parseFloat(inpAmt.value)}))
      const cancel = document.createElement('button')
      cancel.textContent = 'Cancel'
      cancel.style.marginLeft = '6px'
      cancel.addEventListener('click', cancelEdit)
      tdAct.appendChild(save)
      tdAct.appendChild(cancel)
      tr.appendChild(tdDate)
      tr.appendChild(tdCat)
      tr.appendChild(tdAmt)
      tr.appendChild(tdAct)
    } else {
      const tdDate = document.createElement('td')
      tdDate.textContent = e.date
      const tdCat = document.createElement('td')
      tdCat.textContent = e.category
      const tdAmt = document.createElement('td')
      tdAmt.textContent = money(e.amount)
      const tdAct = document.createElement('td')
      const edit = document.createElement('button')
      edit.textContent = 'Edit'
      edit.addEventListener('click', ()=> startEdit('expenses', idx))
      const del = document.createElement('button')
      del.textContent = 'Delete'
      del.style.marginLeft = '6px'
      del.addEventListener('click', ()=> deleteItem('expenses', idx))
      tdAct.appendChild(edit)
      tdAct.appendChild(del)
      tr.appendChild(tdDate)
      tr.appendChild(tdCat)
      tr.appendChild(tdAmt)
      tr.appendChild(tdAct)
    }
    tbody.appendChild(tr)
  })
  const grand = state.expenses.reduce((a,b)=>a+b.amount,0)
  document.getElementById('grand-total').textContent = money(grand)
  const spentEl = document.getElementById('spent-display')
  if (spentEl) spentEl.textContent = money(grand)
  const balEl = document.getElementById('balance-display')
  if (balEl) balEl.textContent = money(state.balance || 0)
  const remEl = document.getElementById('remaining-display')
  if (remEl) remEl.textContent = money((state.balance || 0) - grand)
  const totals = {}
  for (const e of state.expenses) {
    totals[e.category] = (totals[e.category]||0)+e.amount
  }
  const ct = document.getElementById('category-totals')
  ct.innerHTML = ''
  Object.keys(totals).sort().forEach(k=>{
    const d = document.createElement('div')
    d.className = 'pill'
    const name = document.createElement('span')
    name.textContent = k
    const val = document.createElement('span')
    val.textContent = money(totals[k])
    d.appendChild(name)
    d.appendChild(val)
    ct.appendChild(d)
  })
  const pbody = document.querySelector('#planned-table tbody')
  pbody.innerHTML = ''
  state.planned.forEach((e, idx) => {
    const tr = document.createElement('tr')
    if (state.editing && state.editing.type==='planned' && state.editing.idx===idx) {
      const tdDate = document.createElement('td')
      const inpDate = document.createElement('input')
      inpDate.type = 'date'
      inpDate.value = e.date
      tdDate.appendChild(inpDate)
      const tdCat = document.createElement('td')
      const inpCat = document.createElement('input')
      inpCat.type = 'text'
      inpCat.value = e.category
      tdCat.appendChild(inpCat)
      const tdAmt = document.createElement('td')
      const inpAmt = document.createElement('input')
      inpAmt.type = 'number'
      inpAmt.step = '0.01'
      inpAmt.value = e.amount
      tdAmt.appendChild(inpAmt)
      const tdAct = document.createElement('td')
      const save = document.createElement('button')
      save.textContent = 'Save'
      save.addEventListener('click', ()=> saveEdit('planned', idx, {date: inpDate.value, category: inpCat.value, amount: parseFloat(inpAmt.value)}))
      const cancel = document.createElement('button')
      cancel.textContent = 'Cancel'
      cancel.style.marginLeft = '6px'
      cancel.addEventListener('click', cancelEdit)
      tdAct.appendChild(save)
      tdAct.appendChild(cancel)
      tr.appendChild(tdDate)
      tr.appendChild(tdCat)
      tr.appendChild(tdAmt)
      tr.appendChild(tdAct)
    } else {
      const tdDate = document.createElement('td')
      tdDate.textContent = e.date
      const tdCat = document.createElement('td')
      tdCat.textContent = e.category
      const tdAmt = document.createElement('td')
      tdAmt.textContent = money(e.amount)
      const tdAct = document.createElement('td')
      const edit = document.createElement('button')
      edit.textContent = 'Edit'
      edit.addEventListener('click', ()=> startEdit('planned', idx))
      const del = document.createElement('button')
      del.textContent = 'Delete'
      del.style.marginLeft = '6px'
      del.addEventListener('click', ()=> deleteItem('planned', idx))
      tdAct.appendChild(edit)
      tdAct.appendChild(del)
      tr.appendChild(tdDate)
      tr.appendChild(tdCat)
      tr.appendChild(tdAmt)
      tr.appendChild(tdAct)
    }
    pbody.appendChild(tr)
  })
  const pgrand = state.planned.reduce((a,b)=>a+b.amount,0)
  const pt = document.getElementById('planned-total')
  if (pt) pt.textContent = money(pgrand)
}
function extractBalance(text) {
  const s = normalizeText(text)
  const r1 = s.match(/\b(i\s+have|have|my\s+(?:money|balance|budget|cash|wallet)|balance|budget)\s+(?:is\s+|=|:)?\s*(?:about\s+|around\s+)?(\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed|درهم|د\.?م\.?)?\b/i)
  if (r1) return parseFloat(r1[2])
  const r2 = s.match(/\b(?:balance|budget|money)\s*(?:is\s+|=|:)?\s*(?:usd|dollar|dollars|dirham|dh|mad|aed|درهم|د\.?م\.?)\s*(\d+(?:\.\d+)?)\b/i)
  if (r2) return parseFloat(r2[1])
  const r3 = s.match(/\bset\s+(?:my\s+)?(?:balance|budget|money)\s+to\s+(\d+(?:\.\d+)?)\b/i)
  if (r3) return parseFloat(r3[1])
  return null
}
function extractBalanceDelta(text) {
  const s = normalizeText(text)
  const plus1 = s.match(/\badd\s+(?:to\s+)?(?:my\s+)?(?:balance|budget|money|cash|wallet)\s+(?:by\s+)?(\d+(?:\.\d+)?)\b/i)
  if (plus1) return parseFloat(plus1[1])
  const plus2 = s.match(/\badd\s+(\d+(?:\.\d+)?)\s+(?:to\s+)?(?:my\s+)?(?:balance|budget|money|cash|wallet)\b/i)
  if (plus2) return parseFloat(plus2[1])
  const plus3 = s.match(/\bincrease\s+(?:my\s+)?(?:balance|budget|money|cash|wallet)\s+(?:by\s+)?(\d+(?:\.\d+)?)\b/i)
  if (plus3) return parseFloat(plus3[1])
  const plus4 = s.match(/\btop\s*up\s+(?:my\s+)?(?:balance|budget|money|cash|wallet)?\s*(\d+(?:\.\d+)?)\b/i)
  if (plus4) return parseFloat(plus4[1])
  const plus5 = s.match(/\bdeposit\s+(\d+(?:\.\d+)?)\b/i)
  if (plus5) return parseFloat(plus5[1])
  const minus1 = s.match(/\bremove\s+(\d+(?:\.\d+)?)\s+from\s+(?:my\s+)?(?:balance|budget|money|cash|wallet)\b/i)
  if (minus1) return -parseFloat(minus1[1])
  const minus2 = s.match(/\bsubtract\s+(\d+(?:\.\d+)?)\s+from\s+(?:my\s+)?(?:balance|budget|money|cash|wallet)\b/i)
  if (minus2) return -parseFloat(minus2[1])
  const minus3 = s.match(/\bdecrease\s+(?:my\s+)?(?:balance|budget|money|cash|wallet)\s+(?:by\s+)?(\d+(?:\.\d+)?)\b/i)
  if (minus3) return -parseFloat(minus3[1])
  const minus4 = s.match(/\bwithdraw\s+(\d+(?:\.\d+)?)\b/i)
  if (minus4) return -parseFloat(minus4[1])
  return null
}
function startEdit(type, idx) {
  state.editing = {type, idx}
  renderTable()
}
function cancelEdit() {
  state.editing = null
  renderTable()
}
function saveEdit(type, idx, payload) {
  const arr = type==='expenses' ? state.expenses : state.planned
  const next = {...arr[idx]}
  if (payload.date) next.date = payload.date
  if (payload.category) next.category = payload.category
  if (!isNaN(payload.amount)) next.amount = payload.amount
  arr[idx] = next
  state.editing = null
  persist()
  renderTable()
  pushMsg('Row updated.', 'bot')
}
function deleteItem(type, idx) {
  const arr = type==='expenses' ? state.expenses : state.planned
  arr.splice(idx,1)
  state.editing = null
  persist()
  renderTable()
  pushMsg('Row deleted.', 'bot')
}
function pushMsg(text, who) {
  const n = document.createElement('div')
  n.className = `msg ${who}`
  n.textContent = text
  document.getElementById('chat-log').appendChild(n)
  const log = document.getElementById('chat-log')
  log.scrollTop = log.scrollHeight
}
function replyFor(items) {
  if (!items.length) return 'I did not find any amounts. Try phrases like “spent 20 dirham buying groceries”.'
  const today = new Date(todayISO())
  const nowItems = []
  const futureItems = []
  for (const i of items) {
    const d = new Date(i.date)
    if (d > today) futureItems.push(i)
    else nowItems.push(i)
  }
  const partsNow = nowItems.map(i=>`${money(i.amount)} for ${i.category} on ${i.date}`)
  const partsFuture = futureItems.map(i=>`${money(i.amount)} for ${i.category} on ${i.date}`)
  const sumNow = nowItems.reduce((a,b)=>a+b.amount,0)
  const sumFuture = futureItems.reduce((a,b)=>a+b.amount,0)
  if (futureItems.length && nowItems.length) return `Added now: ${partsNow.join('; ')} (Subtotal ${money(sumNow)}). Planned: ${partsFuture.join('; ')} (Subtotal ${money(sumFuture)}).`
  if (futureItems.length) return `Planned: ${partsFuture.join('; ')}. Subtotal ${money(sumFuture)}.`
  return `Added ${partsNow.join('; ')}. Subtotal ${money(sumNow)}.`
}
function onSend() {
  const input = document.getElementById('chat-text')
  const text = input.value.trim()
  if (!text) return
  pushMsg(text, 'user')
  const bal = extractBalance(text)
  const delta = extractBalanceDelta(text)
  const items = parseInput(text)
  addExpenses(items)
  let msg = ''
  if (bal != null) {
    state.balance = bal
    persist()
    const spent = state.expenses.reduce((a,b)=>a+b.amount,0)
    msg += `Balance set to ${money(state.balance)}. Remaining ${money(state.balance - spent)}. `
    renderTable()
  }
  if (delta != null) {
    state.balance = (state.balance || 0) + delta
    persist()
    const spent = state.expenses.reduce((a,b)=>a+b.amount,0)
    if (delta >= 0) msg += `Added ${money(delta)} to balance. `
    else msg += `Removed ${money(Math.abs(delta))} from balance. `
    msg += `Remaining ${money(state.balance - spent)}. `
    renderTable()
  }
  msg += replyFor(items)
  pushMsg(msg, 'bot')
  input.value = ''
}
function onClear() {
  state.expenses = []
  persist()
  renderTable()
  pushMsg('Cleared all expenses.', 'bot')
}
function onClearPlanned() {
  state.planned = []
  persist()
  renderTable()
  pushMsg('Cleared all planned expenses.', 'bot')
}
function init() {
  load()
  document.getElementById('send-btn').addEventListener('click', onSend)
  document.getElementById('chat-text').addEventListener('keydown', e=>{ if (e.key==='Enter') onSend() })
  document.getElementById('clear-btn').addEventListener('click', onClear)
  const cp = document.getElementById('clear-planned-btn')
  if (cp) cp.addEventListener('click', onClearPlanned)
  pushMsg('Tell me about your spending, e.g., “Today I spent 20 dirham buying groceries, 10 dirham on taxi”. Set your balance by saying “I have 100 dirham” or “balance is 500”. Use dates like “tomorrow” or “2025-12-31” for planned expenses.', 'bot')
}
document.addEventListener('DOMContentLoaded', init)
