import { TRACKS } from './tracks.js'
const STEPS = [1, 2, 4, 7, 11, 16]
const $ = id => document.getElementById(id)
const start = Date.UTC(2026, 9, 10)
const now = new Date()
const dayNum = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - start) / 864e5)
const today = 'd' + dayNum
const trackId = TRACKS[((dayNum % TRACKS.length) + TRACKS.length) % TRACKS.length]
let state = JSON.parse(localStorage.getItem('hc-' + today) || '{"guesses":[],"done":false,"won":false}')
let stats = JSON.parse(localStorage.getItem('hc-stats') || '{"played":0,"wins":0,"streak":0,"best":0,"last":null}')
let track = null, picked = null, timer = null
const audio = new Audio()

const save = () => localStorage.setItem('hc-' + today, JSON.stringify(state))

async function load() {
  const r = await fetch(`https://itunes.apple.com/lookup?id=${trackId}&country=nz`)
  const j = await r.json()
  track = j.results[0]
  audio.src = track.previewUrl
  render()
}

function render() {
  $('board').innerHTML = STEPS.map((s, i) => {
    const g = state.guesses[i]
    const cls = g === undefined ? '' : g === 'SKIP' ? 'skip' : g === 'RIGHT' ? 'right' : 'wrong'
    const txt = g === undefined ? '' : g === 'SKIP' ? 'Skipped' : g === 'RIGHT' ? 'Correct' : g
    return `<div class="slot ${cls}">${txt}</div>`
  }).join('')
  if (state.done) showEnd()
}

function play() {
  const len = STEPS[Math.min(state.guesses.length, 5)]
  const max = state.done ? 30 : len
  audio.currentTime = 0
  audio.play()
  clearInterval(timer)
  timer = setInterval(() => {
    $('fill').style.width = Math.min(100, audio.currentTime / 16 * 100) + '%'
    if (audio.currentTime >= max) { audio.pause(); clearInterval(timer) }
  }, 50)
}

function finish(won) {
  state.done = true; state.won = won; save()
  stats.played++
  if (won) {
    stats.wins++
    stats.streak = stats.last === 'd' + (dayNum - 1) ? stats.streak + 1 : 1
    stats.best = Math.max(stats.best, stats.streak)
  } else stats.streak = 0
  stats.last = today
  localStorage.setItem('hc-stats', JSON.stringify(stats))
  render()
}

function guess(g) {
  if (state.done || !track) return
  state.guesses.push(g); save()
  if (g === 'RIGHT') return finish(true)
  if (state.guesses.length >= 6) return finish(false)
  render()
}

function shareText() {
  const sq = state.guesses.map(g => g === 'RIGHT' ? '🟩' : g === 'SKIP' ? '⬛' : '🟥').join('')
  return `Heardle Clone #${dayNum + 1}\n🔊${sq}${'⬜'.repeat(6 - state.guesses.length)}\n${location.href}`
}

function showEnd() {
  $('guessbox').hidden = true
  const e = $('end'); e.hidden = false
  e.innerHTML = `<p>${state.won ? 'You got it.' : 'Better luck tomorrow.'}</p>
  <img src="${track.artworkUrl100}" alt=""><p><b>${track.trackName}</b><br>${track.artistName}</p>
  <p><a href="${track.trackViewUrl}" target="_blank" rel="noopener">Listen to the full song on Apple Music</a></p>
  <p>Played ${stats.played} · Won ${stats.wins} · Streak ${stats.streak} · Best ${stats.best}</p>
  <button id="share">Copy result</button>`
  $('share').onclick = () => { navigator.clipboard.writeText(shareText()); $('share').textContent = 'Copied' }
}

let t
$('guess').oninput = () => {
  picked = null
  clearTimeout(t)
  const q = $('guess').value.trim()
  if (q.length < 2) { $('sugg').innerHTML = ''; return }
  t = setTimeout(async () => {
    const r = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=8&country=nz`)
    const j = await r.json()
    $('sugg').innerHTML = ''
    j.results.forEach(s => {
      const li = document.createElement('li')
      li.textContent = `${s.trackName} - ${s.artistName}`
      li.onclick = () => { picked = s; $('guess').value = li.textContent; $('sugg').innerHTML = '' }
      $('sugg').appendChild(li)
    })
  }, 300)
}
const norm = s => s.toLowerCase().replace(/\(.*?\)|\[.*?\]/g, '').replace(/[^a-z0-9]/g, '')
$('submit').onclick = () => {
  const v = $('guess').value.trim(); if (!v) return
  const right = picked ? picked.trackId === track.trackId || norm(picked.trackName) === norm(track.trackName) && norm(picked.artistName) === norm(track.artistName)
    : norm(v.split(' - ')[0]) === norm(track.trackName)
  guess(right ? 'RIGHT' : v)
  $('guess').value = ''; picked = null
}
$('skip').onclick = () => guess('SKIP')
$('play').onclick = play
load().catch(() => { $('board').textContent = 'Could not load today\'s song. Try again later.' })
