// Tournament state: team registration, a seeded single-elimination bracket,
// and the elimination bookkeeping behind it.
//
// This is bracket-only on purpose. A tournament matchup does not host a Free
// Fire custom room, so nothing here needs the room modal, the voice-channel
// requirement or the join timeout that !play deals with. Staff declare the
// winner of each matchup and the bracket moves on.
//
// Persistence follows the pattern in storage.js: the whole state is read once
// into a module-level cache, writes mark it dirty and are coalesced onto a
// setImmediate. A result can touch the bracket and several teams in one go, and
// without coalescing each of those would rewrite the file separately.
const fs = require('fs');
const path = require('path');
const { MODES, STYLES } = require('./ui');

// Overridable so the bracket logic can be exercised against a scratch file
// instead of the live tournament state.
const FILE = process.env.TOURNAMENT_FILE
  || path.resolve(__dirname, '..', 'data', 'tournaments.json');

const TEAM_SIZES = [2, 3, 4];
const MIN_TEAMS = 2;
const MAX_TEAMS = 64;
const MAX_TEAM_NAME = 24;
const MAX_ARCHIVE = 20;

let cache = null;
let dirty = false;
let scheduled = false;

function emptyState() {
  return { active: null, archive: [] };
}

function load() {
  if (cache) return cache;
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    cache = d && typeof d === 'object' && !Array.isArray(d) ? d : emptyState();
  } catch (e) {
    cache = emptyState();
  }
  if (!cache.active || typeof cache.active !== 'object') cache.active = null;
  if (!Array.isArray(cache.archive)) cache.archive = [];
  return cache;
}

function persist() {
  dirty = true;
  if (scheduled) return;
  scheduled = true;
  setImmediate(() => {
    scheduled = false;
    flush();
  });
}

function flush() {
  if (!dirty || !cache) return;
  try {
    const dir = path.dirname(FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
    dirty = false;
  } catch (e) {
    console.log('[TOURNAMENT] flush failed:', e.message);
  }
}

let exitHooked = false;
function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  process.on('exit', () => flush());
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { flush(); process.exit(0); });
  }
}
hookExit();

// ---------------------------------------------------------------------------
// Seeding
//
// A bracket has to be a power of two, so an entry field of 6 teams is padded to
// 8 and the two empty slots become byes. Where the padding lands decides who
// meets whom, so the seeds are placed in the standard order rather than simply
// sorted: 1v4, 2v3, and 1v8, 4v5, 2v7, 3v6 at eight. Sorting alone would hand
// the top seed a first-round bye in some sizes and not others.
// ---------------------------------------------------------------------------
function seedOrder(size) {
  let order = [1, 2];
  for (let r = 2; r <= Math.round(Math.log2(size)); r++) {
    const len = order.length * 2;
    const next = [];
    for (let i = 0; i < order.length; i++) {
      next.push(order[i]);
      next.push(len + 1 - order[i]);
    }
    order = next;
  }
  return order;
}

function nextPow2(n) {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

function newMatch(round, index, a, b) {
  return {
    id: `r${round}m${index}`,
    a: a || null,
    b: b || null,
    winner: null,
    // 'pending' = waiting for a decision, 'live' = both teams in, staff must
    // pick a winner, 'done' = decided, 'void' = both slots empty (only possible
    // where byes collided) and simply passes through.
    status: (a && b) ? 'live' : 'pending',
    decidedBy: null,
    decidedAt: null
  };
}

// Builds the bracket.
//
// drawOrder, when given, is the sequence of seed numbers to place in bracket
// slots rather than the standard seed order. That is how the roulette sets the
// pairings: it shuffles the seeds and passes them here, so the bracket people
// were shown by the spin is literally the bracket that gets built. Passing seed
// numbers rather than team ids is what keeps a padded field working, since a
// non-power-of-two entry still needs byes in the same slots.
function createBracket(teamIds, drawOrder) {
  const size = nextPow2(Math.max(2, teamIds.length));
  const order = drawOrder || seedOrder(size);
  const bySeed = new Map(teamIds.map((id, i) => [i + 1, id]));

  const first = new Array(size).fill(null);
  order.forEach((seed, pos) => {
    first[pos] = bySeed.get(seed) || null;
  });

  // Byes are already spread correctly by seedOrder, so there is deliberately no
  // pass here to redistribute them. seedOrder places the absent seeds across the
  // round rather than at the end: 5 teams into 8 slots gives 1v-, 4v5, 2v-, 3v-
  // -- one bye per matchup, instead of both stacked on the last one where a
  // second would be wasted and a team would be left with nowhere to go. That
  // failure is invisible until the final, where the tournament cannot finish.
  //
  // It also means a draw order has to be a full permutation of 1..n. Passing a
  // shorter list would leave its tail null, which is a different problem: those
  // slots are genuine byes rather than missing seeds.

  const rounds = [];
  let count = size / 2;
  let number = 1;
  while (count >= 1) {
    const matches = [];
    for (let i = 0; i < count; i++) {
      matches.push(newMatch(
        number,
        i + 1,
        number === 1 ? first[i * 2] : null,
        number === 1 ? first[i * 2 + 1] : null
      ));
    }
    rounds.push({ number, matches });
    count = Math.floor(count / 2);
    number++;
  }
  return rounds;
}

// Is this slot genuinely empty, or is it just waiting for a feeder match that has
// not been played yet?
//
// This distinction is the whole ball game. In round 1 a slot is settled the
// moment the bracket is built -- nobody is going to put a team there later. But
// in round 2 an empty slot means "the match feeding it has not been decided", and
// treating that as a bye auto-advances the other team and quietly eliminates a
// team that was never beaten. With 8 teams that produced a bracket where every
// round from 2 onwards read BYE v BYE and 7 teams were marked eliminated with one
// decision.
//
// A slot is only settled-empty when every match that can feed it is finished and
// none of them produced a winner.
function slotSettledEmpty(t, roundIndex, matchIndex, side) {
  const round = t.rounds[roundIndex];
  const m = round && round.matches[matchIndex];
  if (!m) return true;
  if (side === 'a') if (m.a) return false;
  else if (m.b) return false;

  // Round 1 is filled once and never again.
  if (roundIndex === 0) return true;

  // Feeder matches are 2i (slot a) and 2i+1 (slot b) of the previous round.
  const feederIndex = matchIndex * 2 + (side === 'a' ? 0 : 1);
  const prev = t.rounds[roundIndex - 1];
  const feeder = prev && prev.matches[feederIndex];
  if (!feeder) return true;

  // Still to come, so this slot is simply not filled yet.
  if (feeder.status !== 'done' && feeder.status !== 'void') return false;

  // Finished, but it produced a winner -- who has already been placed in this
  // slot by placeInNextRound. The empty check above would have caught that.
  return true;
}

// Advances every matchup that has one team and a settled-empty other side, and
// voids the ones with two settled-empty sides. Repeated until stable, because a
// bye that resolves early can settle the matchup behind it.
function resolveByes(t) {
  let moved = true;
  while (moved) {
    moved = false;
    for (let r = 0; r < t.rounds.length; r++) {
      const round = t.rounds[r];
      for (let i = 0; i < round.matches.length; i++) {
        const m = round.matches[i];
        if (m.status === 'done' || m.status === 'void') continue;
        if (m.a && m.b) continue;

        const emptyA = !m.a;
        const emptyB = !m.b;
        // Proceed only when every empty side is settled. A side that is empty but
        // still waiting on an unplayed feeder makes the whole matchup pending --
        // checking only that both sides are empty would strand a team that is
        // sitting in the other slot.
        if (emptyA && !slotSettledEmpty(t, r, i, 'a')) continue;
        if (emptyB && !slotSettledEmpty(t, r, i, 'b')) continue;

        const auto = m.a || m.b || null;
        m.status = 'void';
        m.winner = auto;
        if (auto) {
          m.decidedAt = Date.now();
          m.auto = true;
        }
        placeInNextRound(t, r, i, auto);
        moved = true;
      }
    }
  }
}

// Match i of round r feeds match floor(i/2) of round r+1. An even i fills slot a,
// an odd one slot b, which is what makes the winners of two first-round
// matches meet in the same second-round match.
function placeInNextRound(t, roundIndex, matchIndex, teamId) {
  const next = t.rounds[roundIndex + 1];
  if (!next) return;
  const target = next.matches[Math.floor(matchIndex / 2)];
  if (!target) return;
  if (matchIndex % 2 === 0) target.a = teamId || null;
  else target.b = teamId || null;

  if (target.a && target.b) target.status = 'live';
  else if (target.status !== 'done' && target.status !== 'void') target.status = 'pending';
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
function getActive() {
  return load().active;
}

function getTeam(t, teamId) {
  if (!t || !Array.isArray(t.teams)) return null;
  return t.teams.find(x => x.id === teamId) || null;
}

function findTeam(t, query) {
  if (!t || !Array.isArray(t.teams) || !query) return null;
  const q = String(query).trim().toLowerCase();
  return t.teams.find(x => x.id === q)
    || t.teams.find(x => x.name.toLowerCase() === q)
    || null;
}

function teamOfUser(t, userId) {
  if (!t || !Array.isArray(t.teams)) return null;
  return t.teams.find(x => (x.members || []).includes(userId)) || null;
}

function aliveTeams(t) {
  if (!t || !Array.isArray(t.teams)) return [];
  return t.teams.filter(x => x.status === 'active');
}

function eliminatedTeams(t) {
  if (!t || !Array.isArray(t.teams)) return [];
  return t.teams.filter(x => x.status === 'eliminated');
}

// The matchup staff are being asked to settle: both sides are known and nobody
// has declared a winner yet. Lowest round first, so the bracket is worked from
// the top down.
function getLiveMatch(t) {
  if (!t || !Array.isArray(t.rounds)) return null;
  for (let r = 0; r < t.rounds.length; r++) {
    for (const m of t.rounds[r].matches) {
      if (m.status === 'live' && !m.winner && m.a && m.b) return { round: t.rounds[r], match: m };
    }
  }
  return null;
}

function findMatch(t, matchId) {
  if (!t || !Array.isArray(t.rounds) || !matchId) return null;
  for (const round of t.rounds) {
    for (const m of round.matches) {
      if (m.id === matchId) return { round, match: m };
    }
  }
  return null;
}

function totalRounds(t) {
  return t && Array.isArray(t.rounds) ? t.rounds.length : 0;
}

// Where the bracket currently is, for the header line.
function getProgress(t) {
  const total = totalRounds(t);
  const live = getLiveMatch(t);
  const roundNumber = live ? live.round.number : (t && t.finishedRound) || total;
  return {
    roundNumber: Math.min(Math.max(1, roundNumber), total || 1),
    totalRounds: total,
    alive: aliveTeams(t).length,
    total: t && Array.isArray(t.teams) ? t.teams.length : 0,
    championId: t ? t.champion : null,
    finished: !!(t && t.status === 'finished')
  };
}

// Teams still in with at least one win, strongest first. This is the "qualified
// line" the bracket post shows above the eliminated list.
function qualifiedLine(t) {
  return aliveTeams(t)
    .filter(x => (x.wins || 0) > 0)
    .sort((a, b) => (b.wins || 0) - (a.wins || 0) || (b.roundsPlayed || 0) - (a.roundsPlayed || 0));
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------
function newId() {
  return Math.random().toString(36).slice(2, 8);
}

function createTournament({ name, teamSize, channelId, createdBy }) {
  const state = load();
  if (state.active) {
    return { ok: false, reason: 'already_active', tournament: state.active };
  }
  const t = {
    id: newId(),
    name: String(name || 'Tournament').slice(0, 60).trim() || 'Tournament',
    teamSize: TEAM_SIZES.includes(Number(teamSize)) ? Number(teamSize) : 4,
    channelId: channelId || null,
    createdBy: createdBy || null,
    createdAt: Date.now(),
    status: 'signup',
    // Which game mode this tournament is played in. Null until the organiser
    // picks one, at which point style holds the visual style too. Both are
    // decided by the admin, so neither is asked of the teams.
    mode: null,
    style: null,
    teams: [],
    rounds: [],
    champion: null,
    finishedRound: null,
    messageId: null,
    signupMessageId: null
  };
  state.active = t;
  persist();
  return { ok: true, tournament: t };
}

// Records the mode (and style, where the mode has one) the organiser chose.
// Kept separate from createTournament because the choice arrives from an
// ephemeral admin-only menu afterwards rather than from the command itself.
//
// The style is replaced rather than merged: only amo-yes carries one, so
// choosing amo must clear a style left over from a previous amo-yes pick.
// Stale artwork from a mode that no longer applies is worse than none at all.
function setMode(t, mode, style) {
  if (!t) return { ok: false, reason: 'no_active_tournament' };
  if (t.status !== 'signup') return { ok: false, reason: 'signups_closed' };
  const known = MODES.some(m => m.value === mode);
  if (!known) return { ok: false, reason: 'bad_mode' };

  // amo-yes is the only mode with a style, so it is also the only one where a
  // style argument is meaningful. A bad style name is ignored rather than
  // refused: the mode is still a valid choice and the organiser can correct the
  // style on the next pick.
  t.style = (mode === 'ammo' && STYLES.some(s => s.value === style)) ? style : null;
  t.mode = mode;
  persist();
  return { ok: true, mode, style: t.style };
}

// Parses a !tsign command into a roster and an optional team name.
//
// This is a pure function on purpose. It is the part that decides who ends up on
// a team, so it is far easier to be sure about when it can be handed a string
// and a list of mentioned ids than when it can only be exercised through Discord.
//
// The author is always part of the roster, so `!tsign @friend` is enough to enter
// a 2v2 -- asking someone to tag themselves as well is a papercut, not a
// safeguard. Mentions are read first and whatever text is left over becomes the
// name, so `!tsign Team Vertex @a @b` works.
function parseSignCommand(text, authorId, mentionedIds, teamSize) {
  const mentioned = Array.from(new Set((mentionedIds || []).filter(Boolean)));
  const roster = Array.from(new Set([authorId, ...mentioned]));

  if (roster.length < teamSize) {
    return { ok: false, reason: 'too_few', need: teamSize - roster.length, got: roster.length };
  }
  if (roster.length > teamSize) {
    return { ok: false, reason: 'too_many', got: roster.length, max: teamSize };
  }

  // The leading command word is stripped whether it was typed with ! or with &,
  // because the message router accepts both -- otherwise "&tsign Team X" would
  // try to register a team literally called "tsign Team X".
  const name = String(text == null ? '' : text)
    .replace(/<@!?\d+>/g, ' ')
    .replace(/^\s*[&!]?\s*tsign\b\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEAM_NAME);

  return {
    ok: true,
    name,
    captainId: authorId,
    // The author is captain and is not repeated in the partner list. registerTeam
    // re-adds the captain at the front, so listing them twice would be redundant.
    members: roster.filter(id => id !== authorId),
    roster
  };
}

function modeLabel(t) {
  const m = MODES.find(x => x.value === (t && t.mode));
  return m ? m.label : null;
}

function styleLabel(t) {
  const s = STYLES.find(x => x.value === (t && t.style));
  return s ? s.label : null;
}

// Validates a registration and returns a plain reason string on refusal, so the
// caller can put the exact problem in front of the player.
function registerTeam(t, { name, captainId, members, banner }) {
  if (!t) return { ok: false, reason: 'no_active_tournament' };
  if (t.status !== 'signup') return { ok: false, reason: 'signups_closed' };

  const teamName = String(name || '').trim().slice(0, MAX_TEAM_NAME);
  if (teamName.length < 2) return { ok: false, reason: 'bad_name' };

  if (t.teams.length >= MAX_TEAMS) return { ok: false, reason: 'full' };

  const clash = t.teams.find(x => x.name.toLowerCase() === teamName.toLowerCase());
  if (clash) return { ok: false, reason: 'name_taken' };

  // The captain is always member one, then the duo partners they listed.
  const roster = [captainId, ...(members || []).filter(m => m && m !== captainId)];
  const unique = Array.from(new Set(roster));
  if (unique.length !== t.teamSize) return { ok: false, reason: 'wrong_size', got: unique.length, need: t.teamSize };
  if (unique.some(id => !/^\d{15,20}$/.test(id))) return { ok: false, reason: 'bad_member' };

  for (const id of unique) {
    const on = teamOfUser(t, id);
    if (on) return { ok: false, reason: 'player_taken', playerId: id, teamName: on.name };
  }

  const team = {
    id: newId(),
    name: teamName,
    captainId,
    members: unique,
    banner: banner || null,
    seed: t.teams.length + 1,
    status: 'active',
    wins: 0,
    losses: 0,
    roundsPlayed: 0,
    registeredAt: Date.now()
  };
  t.teams.push(team);
  persist();
  return { ok: true, team };
}

function removeTeam(t, query) {
  if (!t || t.status !== 'signup') return { ok: false, reason: 'signups_closed' };
  const team = findTeam(t, query);
  if (!team) return { ok: false, reason: 'no_team' };
  t.teams = t.teams.filter(x => x.id !== team.id);
  persist();
  return { ok: true, team };
}

function setBanner(t, teamId, url) {
  const team = getTeam(t, teamId);
  if (!team) return { ok: false, reason: 'no_team' };
  team.banner = url || null;
  persist();
  return { ok: true, team };
}

// Builds the bracket and marks the tournament running.
//
// A pending draw from the roulette is applied here rather than being discarded,
// because the whole point of showing people a spin is that the bracket it
// produced is the one that gets played. The draw is consumed so a later restart
// of the same tournament does not re-roll it.
function startTournament(t) {
  if (!t) return { ok: false, reason: 'no_active_tournament' };
  if (t.status !== 'signup') return { ok: false, reason: 'already_started' };
  if (t.teams.length < MIN_TEAMS) return { ok: false, reason: 'too_few_teams', count: t.teams.length };

  const ids = t.teams.map(x => x.id);
  let drawOrder = null;
  if (t.pendingDraw && Array.isArray(t.pendingDraw.order) && t.pendingDraw.order.length === ids.length) {
    // The draw stores seed numbers (1..n) rather than ids, so it keeps working
    // if a team is renamed between the spin and the start.
    drawOrder = t.pendingDraw.order;
  }

  t.rounds = createBracket(ids, drawOrder);
  t.status = 'running';
  t.startedAt = Date.now();
  t.drawnAt = drawOrder ? Date.now() : null;
  t.pendingDraw = null;
  resolveByes(t);
  persist();
  return { ok: true, rounds: t.rounds.length, drawn: !!drawOrder };
}

// Queues a roulette result to be used by the next startTournament.
//
// Only accepted while sign-ups are open: once the bracket exists the pairings are
// fixed, and letting a draw land afterwards would silently rewrite matches that
// people have already played.
function setPendingDraw(t, order) {
  if (!t) return { ok: false, reason: 'no_active_tournament' };
  if (t.status !== 'signup') return { ok: false, reason: 'not_signup' };
  if (!Array.isArray(order) || order.length !== t.teams.length) {
    return { ok: false, reason: 'wrong_length', got: Array.isArray(order) ? order.length : 0, need: t.teams.length };
  }
  t.pendingDraw = { order: order.slice(), drawnAt: Date.now() };
  persist();
  return { ok: true };
}

function clearPendingDraw(t) {
  if (!t) return { ok: false, reason: 'no_active_tournament' };
  t.pendingDraw = null;
  persist();
  return { ok: true };
}

// Records a staff decision for one matchup. The loser is struck out of the
// tournament here, which is the whole point of the format: a single loss ends a
// team's run.
function decide(t, matchId, winnerId, decidedBy) {
  if (!t) return { ok: false, reason: 'no_active_tournament' };
  if (t.status !== 'running') return { ok: false, reason: 'not_running' };

  const found = findMatch(t, matchId);
  if (!found) return { ok: false, reason: 'no_match' };
  const m = found.match;
  if (m.winner || m.status === 'void') return { ok: false, reason: 'already_decided' };
  if (!m.a || !m.b) return { ok: false, reason: 'match_not_live' };
  if (winnerId !== m.a && winnerId !== m.b) return { ok: false, reason: 'winner_not_in_match' };

  const loserId = winnerId === m.a ? m.b : m.a;
  const winner = getTeam(t, winnerId);
  const loser = getTeam(t, loserId);
  if (!winner || !loser) return { ok: false, reason: 'team_missing' };

  m.winner = winnerId;
  m.status = 'done';
  m.decidedBy = decidedBy || null;
  m.decidedAt = Date.now();

  winner.wins = (winner.wins || 0) + 1;
  winner.roundsPlayed = (winner.roundsPlayed || 0) + 1;
  loser.losses = (loser.losses || 0) + 1;
  loser.roundsPlayed = (loser.roundsPlayed || 0) + 1;
  loser.status = 'eliminated';
  loser.eliminatedAt = Date.now();
  loser.eliminatedBy = winnerId;

  const roundIndex = t.rounds.indexOf(found.round);
  placeInNextRound(t, roundIndex, found.round.matches.indexOf(m), winnerId);
  resolveByes(t);

  // Last round decided, and nothing left to settle: the winner of that final is
  // the champion.
  const stillLive = getLiveMatch(t);
  if (!stillLive && aliveTeams(t).length <= 1) {
    const last = aliveTeams(t)[0] || winner;
    t.champion = last.id;
    last.status = 'champion';
    t.status = 'finished';
    t.finishedAt = Date.now();
    t.finishedRound = found.round.number;
  }

  persist();
  return { ok: true, winner, loser, champion: t.champion ? getTeam(t, t.champion) : null };
}

// Abandons the current tournament. The teams are kept in the archive so a
// mistake during sign-up can be reviewed rather than silently dropped.
function cancel(t, byId) {
  const state = load();
  if (!state.active) return { ok: false, reason: 'no_active_tournament' };
  const finished = state.active;
  finished.status = 'cancelled';
  finished.cancelledAt = Date.now();
  finished.cancelledBy = byId || null;
  state.archive.unshift(finished);
  if (state.archive.length > MAX_ARCHIVE) state.archive.length = MAX_ARCHIVE;
  state.active = null;
  persist();
  return { ok: true, tournament: finished };
}

function archive(t, byId) {
  const state = load();
  if (!state.active) return { ok: false, reason: 'no_active_tournament' };
  const finished = state.active;
  if (finished.status !== 'finished') return { ok: false, reason: 'not_finished' };
  finished.archivedAt = Date.now();
  finished.archivedBy = byId || null;
  state.archive.unshift(finished);
  if (state.archive.length > MAX_ARCHIVE) state.archive.length = MAX_ARCHIVE;
  state.active = null;
  persist();
  return { ok: true, tournament: finished };
}

function setMessageId(t, messageId) {
  if (!t) return;
  t.messageId = messageId || null;
  persist();
}

function setSignupMessageId(t, messageId) {
  if (!t) return;
  t.signupMessageId = messageId || null;
  persist();
}

module.exports = {
  FILE,
  TEAM_SIZES,
  MIN_TEAMS,
  MAX_TEAMS,
  MAX_TEAM_NAME,
  load,
  flush,
  persist,
  seedOrder,
  createBracket,
  getActive,
  getTeam,
  findTeam,
  teamOfUser,
  aliveTeams,
  eliminatedTeams,
  getLiveMatch,
  findMatch,
  getProgress,
  qualifiedLine,
  createTournament,
  setMode,
  modeLabel,
  styleLabel,
  parseSignCommand,
  setPendingDraw,
  clearPendingDraw,
  registerTeam,
  removeTeam,
  setBanner,
  startTournament,
  decide,
  cancel,
  archive,
  setMessageId,
  setSignupMessageId
};
