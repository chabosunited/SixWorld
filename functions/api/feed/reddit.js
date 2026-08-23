import { json } from '../../_utils.js';

const DEFAULT_SUBREDDITS = ['GTA6unmoderated', 'GTA6_NEW'];
const MAX_SUBREDDITS = 10;
const MAX_ITEMS_PER_FEED = 15;

function cleanSubreddit(value = '') {
  return String(value).trim().replace(/^r\//i, '').replace(/[^a-z0-9_]/gi, '');
}

function decodeXml(value = '') {
  return String(value)
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripHtml(value = '') {
  return decodeXml(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function getLink(block) {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i) || block.match(/<link[^>]*>([^<]+)<\/link>/i);
  return match ? decodeXml(match[1].trim()) : '';
}

function getImage(block) {
  const media = block.match(/<media:thumbnail[^>]+url=["']([^"']+)["'][^>]*>/i) ||
                block.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i);
  if (media) return decodeXml(media[1]);

  const content = getTag(block, 'content') || getTag(block, 'summary');
  const decoded = decodeXml(content);
  const image = decoded.match(/<img[^>]+src=["']([^"']+)["']/i);
  return image ? decodeXml(image[1]) : '';
}

function normalizeDate(value = '') {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function parseFeed(xml, subreddit) {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];

  return entries.slice(0, MAX_ITEMS_PER_FEED).map((entry, index) => {
    const title = stripHtml(getTag(entry, 'title'));
    const date = normalizeDate(getTag(entry, 'updated') || getTag(entry, 'published'));
    const url = getLink(entry);
    const author = stripHtml(getTag(entry, 'name')).replace(/^u\//i, '');
    const image = getImage(entry);
    const contentText = stripHtml(getTag(entry, 'content') || getTag(entry, 'summary'));
    const cleanSummary = contentText
      .replace(/submitted by\s+\/u\/[^\s]+/i, '')
      .replace(/\[link\]\s*\[comments\]/i, '')
      .trim();
    const atomId = stripHtml(getTag(entry, 'id')) || `${subreddit}_${index}_${date}`;

    return {
      id: `reddit_${subreddit}_${atomId.replace(/[^a-z0-9_-]/gi, '_').slice(-72)}`,
      title,
      date,
      source: `r/${subreddit}`,
      image: image || 'assets/news-default.png',
      summary: cleanSummary && cleanSummary !== title
        ? cleanSummary.slice(0, 240)
        : `New post from r/${subreddit}${author ? ` · u/${author}` : ''}`,
      url,
      feedType: 'reddit',
      subreddit,
      author: author ? `u/${author}` : ''
    };
  }).filter(item => item.title && item.url);
}

async function loadSubreddit(subreddit) {
  const feedUrl = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.rss?limit=${MAX_ITEMS_PER_FEED}`;
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'SIXWORLD/1.0 (+https://sixworld.pages.dev; GTA VI fan news aggregator)',
      'Accept': 'application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    }
  });
  if (!response.ok) return { subreddit, items: [], error: `HTTP ${response.status}` };
  const xml = await response.text();
  return { subreddit, items: parseFeed(xml, subreddit), error: null };
}

export async function onRequestGet({ request, waitUntil }) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('subreddits') || url.searchParams.get('subreddit') || DEFAULT_SUBREDDITS.join(',');
  const subreddits = [...new Set(raw.split(',').map(cleanSubreddit).filter(Boolean))].slice(0, MAX_SUBREDDITS);
  const requested = subreddits.length ? subreddits : DEFAULT_SUBREDDITS;

  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set('subreddits', requested.join(','));
  cacheUrl.searchParams.delete('subreddit');
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
  } catch (_) {}

  const results = await Promise.all(requested.map(loadSubreddit));
  const seen = new Set();
  const items = results
    .flatMap(result => result.items)
    .filter(item => {
      const key = item.url || item.id;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 30);

  const payload = {
    subreddits: requested,
    items,
    status: results.map(({ subreddit, error, items }) => ({ subreddit, ok: !error, count: items.length, error }))
  };

  const response = new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json;charset=utf-8',
      'cache-control': 'public, max-age=120, s-maxage=300, stale-while-revalidate=600'
    }
  });

  try { waitUntil?.(caches.default.put(cacheKey, response.clone())); } catch (_) {}
  return response;
}
