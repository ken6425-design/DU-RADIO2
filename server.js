/**
 * DU電台 —— 後端伺服器（雲端 / 本機通用）
 * - 一個網址：首頁分流「我要點歌 / 我是放送端」
 * - 放送端免密碼；候播清單人人可拖曳排序、插播、移除（即時同步）
 * - 沒歌時「自動點歌」：從內建約 200 首（中/韓/英）隨機挑，即時搜尋當下有效影片播放
 * 啟動： node server.js   需求： Node.js 18+
 */
const http = require('http');
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const os = require('os');

const PORT = process.env.PORT || 3000;
const YT_API_KEY = process.env.YT_API_KEY || '';   // 選填：填了搜尋更穩定
const MAX_HISTORY = 200;

/* ===== 內建自動點歌歌單（歌名，由伺服器即時搜尋當下有效影片；中/韓/英約均分） ===== */
const DJ_SONGS = [
  // —— 華語 ——
  '周杰倫 晴天','周杰倫 七里香','周杰倫 稻香','周杰倫 告白氣球','周杰倫 青花瓷','周杰倫 簡單愛','周杰倫 擱淺','周杰倫 髮如雪',
  '五月天 突然好想你','五月天 溫柔','五月天 倔強','五月天 知足','五月天 戀愛ing','五月天 後來的我們','五月天 你不是真正的快樂',
  '林俊傑 江南','林俊傑 修煉愛情','林俊傑 她說','林俊傑 醉赤壁','林俊傑 可惜沒如果',
  '鄧紫棋 泡沫','鄧紫棋 光年之外','鄧紫棋 喜歡你','鄧紫棋 倒數',
  '田馥甄 小幸運','田馥甄 魔鬼中的天使','告五人 愛人錯過','告五人 唯一','告五人 對你說',
  '茄子蛋 浪流連','茄子蛋 這款自作多情','落日飛車 My Jinji','落日飛車 Slow',
  '盧廣仲 刻在我心底的名字','盧廣仲 魚仔','韋禮安 如果可以','韋禮安 還是會','李榮浩 模特','李榮浩 年少有為',
  '陳奕迅 浮誇','陳奕迅 十年','陳奕迅 富士山下','陳奕迅 好久不見','陳奕迅 月亮代表我的心',
  '張惠妹 聽海','張惠妹 我可以抱你嗎','張學友 吻別','王力宏 你不知道的事','蔡依林 日不落','蔡依林 舞孃',
  '周興哲 以後別做朋友','林宥嘉 說謊','林宥嘉 浪費','孫燕姿 遇見','孫燕姿 雨天','梁靜茹 勇氣','梁靜茹 寧夏',
  '蕭敬騰 王妃','A-Lin 給我一個理由忘記','楊丞琳 帶我走','周深 大魚','毛不易 消愁','薛之謙 演員','華晨宇 煙火裡的塵埃',
  '鄧麗君 月亮代表我的心','陳綺貞 旅行的意義','蘇打綠 小情歌','草東沒有派對 大風吹','任賢齊 對面的女孩看過來','伍佰 突然的自我',
  // —— 韓語 ——
  'BTS Dynamite','BTS Butter','BTS Boy With Luv','BTS DNA','BTS Fake Love','BTS Spring Day','BTS Permission to Dance','BTS IDOL',
  'BLACKPINK DDU-DU DDU-DU','BLACKPINK Kill This Love','BLACKPINK How You Like That','BLACKPINK Pink Venom','BLACKPINK Lovesick Girls','BLACKPINK Shut Down',
  'TWICE What Is Love','TWICE Fancy','TWICE Feel Special','TWICE TT','TWICE Cheer Up','TWICE The Feels',
  'NewJeans Hype Boy','NewJeans Attention','NewJeans Ditto','NewJeans OMG','NewJeans Super Shy',
  'IVE Love Dive','IVE After Like','IVE Eleven','IVE I AM','LE SSERAFIM Antifragile','LE SSERAFIM Fearless','LE SSERAFIM Unforgiven',
  'aespa Next Level','aespa Savage','aespa Spicy','aespa Black Mamba',
  'GIDLE Tomboy','GIDLE Nxde','GIDLE Queencard','Red Velvet Psycho','Red Velvet Bad Boy','Red Velvet Red Flavor',
  'EXO Love Shot','EXO Monster','BIGBANG Bang Bang Bang','BIGBANG Fantastic Baby','BIGBANG Loser','BIGBANG Haru Haru',
  'Stray Kids God Menu','Stray Kids MANIAC','Stray Kids S-Class','SEVENTEEN Very Nice','SEVENTEEN Super','SEVENTEEN God of Music',
  'ITZY Wannabe','ITZY Dalla Dalla','ITZY LOCO','TXT Sugar Rush Ride','TXT 0X1 LOVESONG','NCT 127 Kick It','NCT Dream Hot Sauce',
  'IU Love wins all','IU eight','IU Celebrity','IU Lilac','IU Blueming','IU Through the Night','PSY Gangnam Style','PSY Gentleman',
  'ROSE On The Ground','LISA Lalisa','Jennie Solo','Taeyeon INVU','Zico Any Song',
  // —— 西洋 ——
  'Ed Sheeran Shape of You','Ed Sheeran Perfect','Ed Sheeran Photograph','Ed Sheeran Thinking Out Loud',
  'Adele Hello','Adele Rolling in the Deep','Adele Someone Like You','Adele Easy On Me',
  'Bruno Mars Uptown Funk','Bruno Mars 24K Magic','Bruno Mars Just the Way You Are','Bruno Mars Grenade',
  'Maroon 5 Sugar','Maroon 5 Memories','Maroon 5 Girls Like You',
  'Coldplay Yellow','Coldplay Viva la Vida','Coldplay The Scientist','Coldplay Hymn for the Weekend',
  'Taylor Swift Blank Space','Taylor Swift Shake It Off','Taylor Swift Love Story','Taylor Swift Anti-Hero',
  'Justin Bieber Sorry','Justin Bieber Love Yourself','Justin Bieber Baby','Justin Bieber Peaches',
  'The Weeknd Blinding Lights','The Weeknd Starboy','The Weeknd Save Your Tears',
  'Dua Lipa Levitating','Dua Lipa New Rules','Dua Lipa Dont Start Now',
  'Billie Eilish Bad Guy','Billie Eilish Happier Than Ever','Billie Eilish Lovely',
  'Charlie Puth Attention','Charlie Puth We Dont Talk Anymore','Charlie Puth One Call Away',
  'Wiz Khalifa See You Again','Luis Fonsi Despacito','Katy Perry Roar','Katy Perry Dark Horse','Lady Gaga Shallow',
  'Imagine Dragons Believer','Imagine Dragons Thunder','Imagine Dragons Demons','OneRepublic Counting Stars',
  'Sia Chandelier','Sia Cheap Thrills','The Chainsmokers Closer','The Chainsmokers Something Just Like This',
  'Alan Walker Faded','Alan Walker Alone','Shawn Mendes Stitches','Shawn Mendes Treat You Better',
  'Camila Cabello Havana','Post Malone Circles','Post Malone Sunflower','Harry Styles As It Was','Harry Styles Watermelon Sugar',
  'Olivia Rodrigo drivers license','Olivia Rodrigo good 4 u','Lewis Capaldi Someone You Loved','Miley Cyrus Flowers',
];

/* ----------------------------- 共享狀態 ----------------------------- */
const state = { nowPlaying: null, queue: [], history: [], leaderboard: {} };
let seq = 1;
const clients = new Set();

/* ----------------------------- 工具函式 ----------------------------- */
function extractVideoId(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/, /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/, /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) { const m = str.match(re); if (m) return m[1]; }
  return null;
}
const YT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
  Cookie: 'CONSENT=YES+1; SOCS=CAI',
};
async function fetchVideoMeta(videoId) {
  const url = 'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + videoId);
  try {
    const res = await fetch(url, { headers: YT_HEADERS });
    if (!res.ok) throw new Error('oembed ' + res.status);
    const j = await res.json();
    return { title: j.title || '未知曲目', thumbnail: j.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, author: j.author_name || '' };
  } catch (e) {
    return { title: 'YouTube 影片', thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, author: '' };
  }
}
async function searchYouTube(query) {
  if (YT_API_KEY) {
    try {
      const url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=' + encodeURIComponent(query) + '&key=' + YT_API_KEY;
      const res = await fetch(url); const j = await res.json();
      if (j.items) return j.items.map((it) => ({ videoId: it.id.videoId, title: it.snippet.title, thumbnail: it.snippet.thumbnails && it.snippet.thumbnails.medium && it.snippet.thumbnails.medium.url, author: it.snippet.channelTitle, duration: '' }));
    } catch (e) { /* fall through */ }
  }
  return scrapeSearch(query);
}
async function scrapeSearch(query) {
  const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAQ%253D%253D';
  const res = await fetch(url, { headers: YT_HEADERS });
  const html = await res.text();
  const m = html.match(/var ytInitialData\s*=\s*(\{.+?\});<\/script>/s) || html.match(/ytInitialData"?\]?\s*=\s*(\{.+?\});\s*<\/script>/s) || html.match(/ytInitialData\s*=\s*(\{.+?\});/s);
  if (!m) return [];
  let data; try { data = JSON.parse(m[1]); } catch (e) { return []; }
  const results = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object' || results.length >= 12) return;
    if (node.videoRenderer) {
      const v = node.videoRenderer;
      const title = (v.title && v.title.runs && v.title.runs[0] && v.title.runs[0].text) || (v.title && v.title.simpleText) || '';
      if (v.videoId && title) {
        const thumbs = v.thumbnail && v.thumbnail.thumbnails;
        results.push({
          videoId: v.videoId, title,
          thumbnail: (thumbs && thumbs[thumbs.length - 1] && thumbs[thumbs.length - 1].url) || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          author: (v.ownerText && v.ownerText.runs && v.ownerText.runs[0] && v.ownerText.runs[0].text) || '',
          duration: (v.lengthText && v.lengthText.simpleText) || '',
        });
      }
      return;
    }
    for (const k in node) walk(node[k]);
  };
  walk(data); return results;
}

/* ----------------------------- 佇列 + 自動點歌 ----------------------------- */
function promoteIfIdle() {
  if (!state.nowPlaying && state.queue.length) {
    state.nowPlaying = { ...state.queue.shift(), position: 0, duration: 0, paused: false };
  }
}
function finishCurrent(toHistory = true) {
  const cur = state.nowPlaying;
  if (cur) {
    if (toHistory && !cur.isDJ) {
      state.history.unshift({ videoId: cur.videoId, title: cur.title, thumbnail: cur.thumbnail, requester: cur.requester, playedAt: Date.now() });
      if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
      const name = (cur.requester || '匿名').trim() || '匿名';
      state.leaderboard[name] = (state.leaderboard[name] || 0) + 1;
    }
    state.nowPlaying = null;
  }
  promoteIfIdle();
  maybeAutoDJ();
}

let djPending = false;
const djRecent = [];
function pickSongName() {
  let name = DJ_SONGS[0];
  for (let i = 0; i < 40; i++) {
    name = DJ_SONGS[Math.floor(Math.random() * DJ_SONGS.length)];
    if (!djRecent.includes(name)) break;
  }
  djRecent.push(name);
  if (djRecent.length > Math.min(90, DJ_SONGS.length - 10)) djRecent.shift();
  return name;
}
async function maybeAutoDJ() {
  if (state.nowPlaying || state.queue.length || djPending) return;
  djPending = true;
  try {
    const name = pickSongName();
    let results = [];
    try { results = await searchYouTube(name); } catch (e) {}
    if (state.nowPlaying || state.queue.length) return; // 期間有人點歌了
    const v = results && results[0];
    if (v && v.videoId) {
      state.nowPlaying = {
        id: seq++, videoId: v.videoId, title: v.title || name,
        thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        requester: '🎲 自動點歌', isDJ: true, position: 0, duration: 0, paused: false,
      };
      broadcastState();
      broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
    } else {
      setTimeout(maybeAutoDJ, 4000); // 搜尋失敗稍後再試
    }
  } finally {
    djPending = false;
  }
}

/* ----------------------------- 廣播 ----------------------------- */
function publicState() {
  return {
    type: 'state', nowPlaying: state.nowPlaying, queue: state.queue,
    history: state.history.slice(0, 60),
    leaderboard: Object.entries(state.leaderboard).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    online: clients.size,
  };
}
function broadcast(obj, filter) {
  const msg = JSON.stringify(obj);
  for (const c of clients) { if (filter && !filter(c)) continue; if (c.ws.readyState === 1) c.ws.send(msg); }
}
function broadcastState() { broadcast(publicState()); }

/* ----------------------------- HTTP ----------------------------- */
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  if (!q) return res.json({ results: [] });
  try { res.json({ results: await searchYouTube(q) }); }
  catch (e) { res.status(500).json({ results: [], error: 'search_failed' }); }
});
app.get('/api/meta', async (req, res) => {
  const id = extractVideoId(req.query.url || req.query.id);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  res.json({ videoId: id, ...(await fetchVideoMeta(id)) });
});

/* ----------------------------- WebSocket ----------------------------- */
wss.on('connection', (ws) => {
  const client = { ws, role: 'remote' };
  clients.add(client);
  ws.send(JSON.stringify(publicState()));
  broadcast({ type: 'online', online: clients.size });

  ws.on('message', async (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
    switch (msg.type) {
      case 'hello':
        client.role = msg.role === 'player' ? 'player' : 'remote';
        if (client.role === 'player') maybeAutoDJ();
        break;

      case 'add': {
        const videoId = extractVideoId(msg.videoId || msg.url);
        if (!videoId) { ws.send(JSON.stringify({ type: 'error', message: '無法辨識的 YouTube 網址' })); break; }
        let title = msg.title, thumbnail = msg.thumbnail;
        if (!title) { const meta = await fetchVideoMeta(videoId); title = meta.title; thumbnail = meta.thumbnail; }
        const requester = (msg.requester || '').toString().slice(0, 24).trim() || '匿名';
        state.queue.push({ id: seq++, videoId, title, thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, requester, addedAt: Date.now() });
        if (state.nowPlaying && state.nowPlaying.isDJ) {
          finishCurrent(false);
          broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
        }
        promoteIfIdle();
        broadcastState();
        broadcast({ type: 'toast', message: `🎵 ${requester} 點了《${title}》` });
        break;
      }

      case 'remove':
        state.queue = state.queue.filter((q) => q.id !== msg.id);
        broadcastState(); break;

      case 'jump': {
        const i = state.queue.findIndex((q) => q.id === msg.id);
        if (i > 0) { const [it] = state.queue.splice(i, 1); state.queue.unshift(it); broadcastState(); }
        break;
      }

      case 'move': {
        const i = state.queue.findIndex((q) => q.id === msg.id);
        if (i < 0) break;
        let to = (typeof msg.toIndex === 'number') ? msg.toIndex : i;
        to = Math.max(0, Math.min(state.queue.length - 1, to));
        if (to !== i) { const [it] = state.queue.splice(i, 1); state.queue.splice(to, 0, it); broadcastState(); }
        break;
      }

      case 'skip':
        if (client.role !== 'player') break;
        finishCurrent(true); broadcastState();
        broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
        break;

      case 'control':
        if (client.role !== 'player') break;
        broadcast({ type: 'command', action: msg.action, value: msg.value }, (c) => c.role === 'player');
        break;

      case 'ended':
        if (client.role !== 'player') break;
        if (state.nowPlaying && state.nowPlaying.videoId === msg.videoId) {
          finishCurrent(true); broadcastState();
          broadcast({ type: 'command', action: 'load' }, (c) => c.role === 'player');
        }
        break;

      case 'progress':
        if (client.role !== 'player') break;
        if (state.nowPlaying) {
          state.nowPlaying.position = msg.position || 0;
          state.nowPlaying.duration = msg.duration || 0;
          state.nowPlaying.paused = !!msg.paused;
          broadcast({ type: 'progress', position: state.nowPlaying.position, duration: state.nowPlaying.duration, paused: state.nowPlaying.paused });
        }
        break;

      case 'chat': {
        const name = (msg.name || '匿名').toString().slice(0, 24);
        const text = (msg.text || '').toString().slice(0, 200);
        if (text.trim()) broadcast({ type: 'chat', name, text, at: Date.now() });
        break;
      }
      default: break;
    }
  });

  ws.on('close', () => { clients.delete(client); broadcast({ type: 'online', online: clients.size }); });
});

/* ----------------------------- 啟動 ----------------------------- */
function lanIPs() {
  const out = []; const ifaces = os.networkInterfaces();
  for (const name in ifaces) for (const i of ifaces[name]) if (i.family === 'IPv4' && !i.internal) out.push(i.address);
  return out;
}
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  📻  DU電台 已開台\n');
  console.log('  網址首頁（同事打開後選「我要點歌」）：');
  console.log(`    本機： http://localhost:${PORT}`);
  for (const ip of lanIPs()) console.log(`    區域網路： http://${ip}:${PORT}`);
  console.log('\n  放送端（首頁選「我是放送端」，或直接 /player.html）：');
  console.log(`    http://localhost:${PORT}/player.html`);
  console.log('\n  放送端免密碼。沒歌時自動點歌（內建約 200 首中/韓/英）。');
  console.log(YT_API_KEY ? '  搜尋：使用官方 YouTube Data API\n' : '  搜尋：使用網頁解析（免 API key）。\n');
});
