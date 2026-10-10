import { TRACKS } from './tracks.js'
const STEPS = [1, 2, 4, 7, 11, 16]
const $ = id => document.getElementById(id)
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const start = Date.UTC(2026, 9, 10)
const now = new Date()
const dayNum = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 864e5)
const today = 'd' + dayNum
const params = new URLSearchParams(location.search)
const PRACTICE = params.has('practice') || params.has('unlimited')
let trackId = TRACKS[((dayNum % TRACKS.length) + TRACKS.length) % TRACKS.length]
const fresh = () => ({ guesses: [], done: false, won: false })
let state = PRACTICE ? fresh() : JSON.parse(localStorage.getItem('hc-' + today) || 'null') || fresh()
let stats = JSON.parse(localStorage.getItem('hc-stats') || '{"played":0,"wins":0,"streak":0,"best":0,"last":null,"dist":[0,0,0,0,0,0]}')
stats.dist ||= [0, 0, 0, 0, 0, 0]
let track = null, picked = null, raf = null, results = [], active = -1
const audio = new Audio(); audio.preload = 'auto'
const save = () => PRACTICE || localStorage.setItem('hc-' + today, JSON.stringify(state))
const say = m => { $('status').textContent = m }
const unlocked = () => state.done ? 16 : STEPS[Math.min(state.guesses.length, 5)]

// segmented bar: segment widths proportional to each step
const seg = $('seg')
seg.innerHTML = STEPS.map((s, i) => `<div class="s" style="flex:${s - (STEPS[i - 1] || 0)}"><i></i></div>`).join('')

async function load() {
  const id = trackId
  const r = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=nz`)
  const t = (await r.json()).results[0]
  if (id !== trackId) return
  if (!t) throw new Error('missing track')
  track = t
  audio.src = track.previewUrl
  $('badge').href = track.trackViewUrl
  render()
}

function render() {
  $('board').innerHTML = STEPS.map((s, i) => {
    const g = state.guesses[i]
    if (g === undefined) return `<li class="row ${i === state.guesses.length && !state.done ? 'next' : ''}"><span class="n">${i + 1}</span></li>`
    if (g === 'SKIP') return `<li class="row skip"><span class="ic" aria-hidden="true">⏭</span><span>Skipped</span></li>`
    if (g === 'RIGHT') return `<li class="row right"><span class="ic" aria-hidden="true">✓</span><span>${esc(track ? track.trackName : 'Correct')}</span></li>`
    return `<li class="row wrong"><span class="ic" aria-hidden="true">✕</span><span>${esc(g)}</span></li>`
  }).join('')
  const u = unlocked()
  ;[...seg.children].forEach((el, i) => el.classList.toggle('on', STEPS[i] <= u))
  $('unlocked').textContent = `${u} second${u > 1 ? 's' : ''} unlocked`
  const next = STEPS[state.guesses.length + 1]
  $('skip').textContent = next ? `Skip (+${next - STEPS[state.guesses.length]}s)` : 'Give up'
  if (state.done && track) showEnd()
}

function stop() { audio.pause(); cancelAnimationFrame(raf); $('playIcon').setAttribute('d', 'M8 5v14l11-7z'); $('play').setAttribute('aria-label', 'Play clip') }
function paint() {
  const t = audio.currentTime
  ;[...seg.children].forEach((el, i) => {
    const a = STEPS[i - 1] || 0, b = STEPS[i]
    el.firstChild.style.width = Math.max(0, Math.min(1, (t - a) / (b - a))) * 100 + '%'
  })
  $('cur').textContent = `0:${String(Math.floor(t)).padStart(2, '0')}`
  if (t >= (state.done ? 30 : unlocked())) return stop()
  raf = requestAnimationFrame(paint)
}
function play() {
  if (!track) return
  if (!audio.paused) return stop()
  audio.currentTime = 0
  audio.play().then(() => {
    $('playIcon').setAttribute('d', 'M6 5h4v14H6zm8 0h4v14h-4z'); $('play').setAttribute('aria-label', 'Pause clip')
    paint()
  }).catch(() => say('Could not play audio'))
}

function finish(won) {
  state.done = true; state.won = won; save()
  if (PRACTICE) { stop(); render(); if (won) { audio.currentTime = 0; audio.play().catch(() => {}) } return }
  stats.played++
  if (won) {
    stats.wins++; stats.dist[state.guesses.length - 1]++
    stats.streak = stats.last === 'd' + (dayNum - 1) ? stats.streak + 1 : 1
    stats.best = Math.max(stats.best, stats.streak)
  } else stats.streak = 0
  stats.last = today
  localStorage.setItem('hc-stats', JSON.stringify(stats))
  stop(); render()
  if (won) { audio.currentTime = 0; audio.play().catch(() => {}); }
}

function guess(g) {
  if (state.done || !track) return
  state.guesses.push(g); save()
  if (g === 'RIGHT') return finish(true)
  if (state.guesses.length >= 6) return finish(false)
  say(g === 'SKIP' ? 'Skipped' : 'Not quite'); stop(); render()
}

const squares = () => state.guesses.map(g => g === 'RIGHT' ? '🟩' : g === 'SKIP' ? '⬛' : '🟥').join('') + '⬜'.repeat(6 - state.guesses.length)
const statsHtml = () => {
  const max = Math.max(1, ...stats.dist)
  return `<div class="nums"><div><b>${stats.played}</b>Played</div><div><b>${stats.played ? Math.round(stats.wins / stats.played * 100) : 0}%</b>Won</div><div><b>${stats.streak}</b>Streak</div><div><b>${stats.best}</b>Best</div></div>
  <div class="dist">${stats.dist.map((n, i) => `<div><span>${i + 1}</span><i style="width:${8 + n / max * 92}%">${n}</i></div>`).join('')}</div>`
}

function countdown() {
  const d = new Date(); const t = new Date(d); t.setHours(24, 0, 0, 0)
  const s = Math.floor((t - d) / 1000)
  const el = $('cd'); if (el) el.textContent = [s / 3600, s / 60 % 60, s % 60].map(x => String(Math.floor(x)).padStart(2, '0')).join(':')
}

function showEnd() {
  $('game').hidden = true
  $('newSong').hidden = !PRACTICE
  const e = $('end'); e.hidden = false
  const big = (track.artworkUrl100 || '').replace('100x100', '600x600')
  e.innerHTML = `<p class="verdict ${state.won ? 'win' : 'lose'}">${state.won ? `You got it in ${state.guesses.length}!` : "Not today. Here's the song."}</p>
  <div class="card"><img src="${big}" alt="Album art for ${esc(track.trackName)}" width="240" height="240">
  <h2>${esc(track.trackName)}</h2><p class="artist">${esc(track.artistName)}</p>
  <a class="btn apple" href="${track.trackViewUrl}" target="_blank" rel="noopener">Listen on Apple Music</a></div>
  <p class="sq" aria-label="Your result">${squares()}</p>
  <button id="share" class="btn primary wide">Share result</button>
  ${PRACTICE ? '<p class="next">Practice round. Stats are not saved.</p>' : `${statsHtml()}
  <p class="next">Next song in <b id="cd">--:--:--</b></p>`}`
  $('share').onclick = async () => {
    const txt = `Heardle Clone ${PRACTICE ? 'practice' : '#' + (dayNum + 1)}\n🔊${squares()}\n${location.href}`
    try { if (navigator.share && matchMedia('(pointer:coarse)').matches) await navigator.share({ text: txt }); else { await navigator.clipboard.writeText(txt); $('share').textContent = 'Copied to clipboard' } } catch {}
  }
  if (!PRACTICE) { countdown(); clearInterval(window.cdT); window.cdT = setInterval(countdown, 1000) }
}

// autocomplete
const input = $('guess'), list = $('sugg')
function setActive(i) {
  active = i
  ;[...list.children].forEach((li, j) => { li.setAttribute('aria-selected', j === i); if (j === i) li.scrollIntoView({ block: 'nearest' }) })
  input.setAttribute('aria-activedescendant', i >= 0 ? 'opt' + i : '')
}
function close() { list.innerHTML = ''; results = []; active = -1; $('combo').setAttribute('aria-expanded', 'false') }
function pick(s) { picked = s; input.value = `${s.trackName} - ${s.artistName}`; close(); $('submit').disabled = false; $('submit').focus() }
let t, seq = 0
input.oninput = () => {
  picked = null; $('submit').disabled = !input.value.trim()
  clearTimeout(t)
  const q = input.value.trim()
  if (q.length < 2) return close()
  t = setTimeout(async () => {
    const my = ++seq
    try {
      const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8&country=nz`)
      const j = await r.json(); if (my !== seq) return
      results = j.results; list.innerHTML = ''; active = -1
      results.forEach((s, i) => {
        const li = document.createElement('li')
        li.id = 'opt' + i; li.setAttribute('role', 'option')
        li.innerHTML = `<img src="${s.artworkUrl60}" alt="" width="40" height="40"><span><b>${esc(s.trackName)}</b><small>${esc(s.artistName)}</small></span>`
        li.onmousedown = e => { e.preventDefault(); pick(s) }
        list.appendChild(li)
      })
      $('combo').setAttribute('aria-expanded', results.length > 0)
    } catch { close() }
  }, 250)
}
input.onkeydown = e => {
  if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); setActive((active + 1) % results.length) }
  else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); setActive((active - 1 + results.length) % results.length) }
  else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) pick(results[active]); else submit() }
  else if (e.key === 'Escape') close()
}
input.onblur = () => setTimeout(close, 100)

const norm = s => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '')
function submit() {
  const v = input.value.trim(); if (!v || !track) return
  const right = picked ? picked.trackId === track.trackId || (norm(picked.trackName) === norm(track.trackName) && norm(picked.artistName) === norm(track.artistName))
    : norm(v.split(' - ')[0]) === norm(track.trackName)
  input.value = ''; picked = null; $('submit').disabled = true; close()
  guess(right ? 'RIGHT' : v)
}
$('submit').onclick = submit
$('skip').onclick = () => guess('SKIP')
$('play').onclick = play
$('helpBtn').onclick = () => $('help').showModal()
$('statsBtn').onclick = () => { $('statsBody').innerHTML = statsHtml(); $('statsD').showModal() }
document.querySelectorAll('dialog').forEach(d => d.onclick = e => { if (e.target === d) d.close() })
if (!localStorage.getItem('hc-seen')) { localStorage.setItem('hc-seen', '1'); $('help').showModal() }
function newSong() {
  stop()
  const others = TRACKS.filter(id => id !== trackId)
  trackId = others[Math.floor(Math.random() * others.length)]
  state = fresh(); track = null
  $('end').hidden = true; $('end').innerHTML = ''; $('game').hidden = false
  ;[...seg.children].forEach(el => { el.firstChild.style.width = '0' }); $('cur').textContent = '0:00'
  render(); load().then(() => say('New song loaded')).catch(() => say('Could not load the song. Try again.'))
}
if (PRACTICE) {
  document.body.classList.add('practice')
  $('mode').hidden = false
  $('newSong').hidden = false
  $('newSong').onclick = newSong
  newSong()
} else {
  render()
  load().catch(() => say("Could not load today's song. Try again later."))
}
