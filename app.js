const state = {
  expenses: [],
  planned: [],
  initialized: false
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
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed|درهم)\b/i)
  if (!m) return null
  return parseFloat(m[1])
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
  const e = s.match(/\bfor\s+([a-z \-]+)/i)
  if (e) return cleanCategory(e[1])
  const f = s.match(/\busing\s+([a-z \-]+)/i)
  if (f) return cleanCategory(f[1])
  const g = s.match(/\bpaid\s+(?:for\s+)?([a-z \-]+)/i)
  if (g) return cleanCategory(g[1])
  const h = s.match(/\bspent\s+(?:\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed)\s+on\s+([a-z \-]+)/i)
  if (h) return cleanCategory(h[1])
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
  renderTable()
}
function renderTable() {
  const tbody = document.querySelector('#expenses-table tbody')
  tbody.innerHTML = ''
  for (const e of state.expenses) {
    const tr = document.createElement('tr')
    const tdDate = document.createElement('td')
    tdDate.textContent = e.date
    const tdCat = document.createElement('td')
    tdCat.textContent = e.category
    const tdAmt = document.createElement('td')
    tdAmt.textContent = money(e.amount)
    tr.appendChild(tdDate)
    tr.appendChild(tdCat)
    tr.appendChild(tdAmt)
    tbody.appendChild(tr)
  }
  const grand = state.expenses.reduce((a,b)=>a+b.amount,0)
  document.getElementById('grand-total').textContent = money(grand)
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
  for (const e of state.planned) {
    const tr = document.createElement('tr')
    const tdDate = document.createElement('td')
    tdDate.textContent = e.date
    const tdCat = document.createElement('td')
    tdCat.textContent = e.category
    const tdAmt = document.createElement('td')
    tdAmt.textContent = money(e.amount)
    tr.appendChild(tdDate)
    tr.appendChild(tdCat)
    tr.appendChild(tdAmt)
    pbody.appendChild(tr)
  }
  const pgrand = state.planned.reduce((a,b)=>a+b.amount,0)
  const pt = document.getElementById('planned-total')
  if (pt) pt.textContent = money(pgrand)
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
  const items = parseInput(text)
  addExpenses(items)
  pushMsg(replyFor(items), 'bot')
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
  pushMsg('Tell me about your spending, e.g., “Today I spent 20 dirham buying groceries, 10 dirham on taxi”. Use dates like “tomorrow” or “2025-12-31” for planned expenses.', 'bot')
}
document.addEventListener('DOMContentLoaded', init)
