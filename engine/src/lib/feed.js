import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  cdataPropName: '__cdata',
  processEntities: true
});

function textOf(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    if (v.__cdata != null) return String(v.__cdata);
    if (v['#text'] != null) return String(v['#text']);
  }
  return '';
}

function asArray(x) {
  return Array.isArray(x) ? x : x == null ? [] : [x];
}

function cleanText(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detecta RSS ou Atom e devolve itens normalizados. */
export function parseFeed(xml) {
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  if (doc?.rss?.channel) return parseRss(doc.rss.channel);
  if (doc?.channel) return parseRss(doc.channel);
  if (doc?.feed) return parseAtom(doc.feed);
  if (doc?.['rdf:RDF']) return parseRdf(doc['rdf:RDF']); // RSS 1.0
  return [];
}

function parseRss(channel) {
  return asArray(channel.item)
    .map((it) => {
      let link = textOf(it.link);
      if (!link && it.guid) {
        const permalink = it.guid['@_isPermaLink'];
        if (permalink !== 'false') link = textOf(it.guid);
      }
      return {
        title: cleanText(textOf(it.title)),
        description: cleanText(textOf(it.description) || textOf(it['content:encoded'])),
        link: (link || '').trim(),
        pubDate: textOf(it.pubDate) || textOf(it['dc:date']) || '',
        source: cleanText(textOf(it.source))
      };
    })
    .filter((x) => x.title && x.link);
}

function parseRdf(rdf) {
  return asArray(rdf.item)
    .map((it) => ({
      title: cleanText(textOf(it.title)),
      description: cleanText(textOf(it.description)),
      link: (textOf(it.link) || '').trim(),
      pubDate: textOf(it['dc:date']) || '',
      source: cleanText(textOf(it['dc:publisher']))
    }))
    .filter((x) => x.title && x.link);
}

function parseAtom(feed) {
  const feedTitle = cleanText(textOf(feed.title));
  return asArray(feed.entry)
    .map((e) => {
      const links = asArray(e.link);
      const alt = links.find((l) => (l['@_rel'] || 'alternate') === 'alternate') || links[0];
      const link = alt ? alt['@_href'] || textOf(alt) : '';
      return {
        title: cleanText(textOf(e.title)),
        description: cleanText(textOf(e.summary) || textOf(e.content)),
        link: (link || '').trim(),
        pubDate: textOf(e.updated) || textOf(e.published) || '',
        source: feedTitle
      };
    })
    .filter((x) => x.title && x.link);
}
