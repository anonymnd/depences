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
function normalizeCurrency(s) {
  return s.replace(/\$/g,' dirham ')
}
function extractAmount(s) {
  const m = s.match(/(\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed|درهم)\b/i)
  if (!m) return null
  return parseFloat(m[1])
}
function extractCategory(s) {
  const a = s.match(/\bbuy(?:ing)?\s+([a-z \-]+)/i)
  if (a) return a[1].trim().replace(/\s{2,}/g,' ')
  const b = s.match(/\bon\s+([a-z \-]+)/i)
  if (b) return b[1].trim().replace(/\s{2,}/g,' ')
  const c = s.match(/\bfor\s+([a-z \-]+)/i)
  if (c) return c[1].trim().replace(/\s{2,}/g,' ')
  const d = s.match(/\busing\s+([a-z \-]+)/i)
  if (d) return d[1].trim().replace(/\s{2,}/g,' ')
  const e = s.match(/\bspent\s+(?:\d+(?:\.\d+)?)\s*(?:usd|dollar|dollars|dirham|dh|mad|aed)\s+on\s+([a-z \-]+)/i)
  if (e) return e[1].trim()
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
  const chunks = parseChunks(normalizeCurrency(text.toLowerCase()))
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
