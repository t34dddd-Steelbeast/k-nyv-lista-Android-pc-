(() => {
  'use strict';

  const LOCAL_KEY = 'polc.books.v1';
  const LOCAL_LISTS_KEY = 'polc.lists.v1';
  const CONFIG_KEY = 'polc.supabase.config.v2';
  const DEFAULT_SUPABASE_CONFIG = {
    url: 'https://liriticqwbpqtcpkbimjh.supabase.co',
    key: 'sb_publishable_IO9xI-sJ4L2kbMdsmGc1dA_BThy_e78'
  };
  const DEFAULT_LIST_NAME = 'El szeretném olvasni';
  const LABELS = { book: 'Könyv', ebook: 'E-könyv', audio: 'Hangoskönyv' };
  const STATUS_LABELS = ['Olvasatlan', 'Olvasom', 'Elolvastam', 'Félbehagytam'];
  const state = { books: [], lists: [], status: 'all', listFilter: 'all', format: 'all', query: '', mode: 'local', user: null, client: null, config: null, installPrompt: null, toastTimer: null, scannerStream: null, scannerActive: false, scannerBusy: false, catalogResults: [] };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  function createId() { return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => { const random = Math.random() * 16 | 0; return (char === 'x' ? random : (random & 0x3 | 0x8)).toString(16); }); }

  function readLocal() {
    try { const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify(state.books)); }
  function readLocalLists() {
    try {
      const stored = localStorage.getItem(LOCAL_LISTS_KEY);
      if (stored === null) {
        const initial = [{ id: createId(), name: DEFAULT_LIST_NAME }];
        localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(initial));
        return initial;
      }
      const value = JSON.parse(stored);
      return Array.isArray(value) ? value.filter(list => list?.id && list?.name) : [];
    } catch { return []; }
  }
  function saveLocalLists() { localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(state.lists)); }
  function cacheKey(userId) { return `polc.cloud.cache.${userId}`; }
  function listsCacheKey(userId) { return `polc.cloud.lists.${userId}`; }
  function readCloudCache(userId) {
    try { const value = JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function readCloudListsCache(userId) {
    try {
      const stored = localStorage.getItem(listsCacheKey(userId));
      if (stored === null) return null;
      const value = JSON.parse(stored);
      return Array.isArray(value) ? value.filter(list => list?.id && list?.name) : [];
    } catch { return []; }
  }
  function saveCloudCache() { if (state.user) localStorage.setItem(cacheKey(state.user.id), JSON.stringify(state.books)); }
  function saveCloudListsCache() { if (state.user) localStorage.setItem(listsCacheKey(state.user.id), JSON.stringify(state.lists)); }
  function readConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null');
      if (stored?.url && stored?.key) return stored;
    } catch {}
    return DEFAULT_SUPABASE_CONFIG;
  }

  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
  }

  function setConnection(kind, message) {
    const badge = $('#connectionBadge');
    badge.className = `connection-badge ${kind}`;
    $('#connectionText').textContent = message;
  }

  function safeCoverUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  }

  function updateSettingsView() {
    $('#accountPanel').hidden = Boolean(state.user);
    $('#signedInPanel').hidden = !state.user;
    $('#signedInEmail').textContent = state.user?.email || '';
    $('#syncExplanation').innerHTML = state.user
      ? `A könyvtárad <strong>közös online adatbázisból</strong> töltődik be. Jelentkezz be ugyanezzel a fiókkal a többi eszközödön is.`
      : `A közös Polc-adatbázis már be van állítva. Hozz létre egy Polc-fiókot, majd jelentkezz be ugyanazzal a fiókkal a telefonon és a számítógépen.`;
    if (state.config) {
      $('#projectUrl').value = state.config.url || '';
      $('#publicKey').value = state.config.key || '';
    }
  }

  function visibleBooks() {
    const query = state.query.trim().toLocaleLowerCase('hu');
    return state.books.filter(book => {
      const statusMatch = state.status === 'all' || book.status === state.status;
      const listMatch = state.listFilter === 'all' || book.customListId === state.listFilter;
      const formatMatch = state.format === 'all' || book.format === state.format;
      const listName = state.lists.find(list => list.id === book.customListId)?.name || '';
      const text = [book.title, book.author, book.isbn, book.category, book.publisher, listName, book.notes].join(' ').toLocaleLowerCase('hu');
      return statusMatch && listMatch && formatMatch && (!query || text.includes(query));
    }).sort((a, b) => (b.updatedAt || b.addedAt || '').localeCompare(a.updatedAt || a.addedAt || ''));
  }

  function coverColor(book) {
    let hash = 0;
    for (const char of (book.title || '')) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
    return Math.abs(hash) % 6;
  }

  function cardHTML(book) {
    const short = (book.title || '?').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('hu');
    const statusClass = book.status === 'Olvasom' ? 'reading' : book.status === 'Elolvastam' ? 'read' : book.status === 'Félbehagytam' ? 'paused' : '';
    const listName = state.lists.find(list => list.id === book.customListId)?.name;
    const coverUrl = safeCoverUrl(book.coverUrl);
    return `<article class="book-card" data-book-id="${esc(book.id)}">
      <div class="book-cover cover-${coverColor(book)}" aria-hidden="true">${coverUrl ? `<img src="${esc(coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true" />` : ''}<span class="cover-initial">${esc(short)}</span><span class="cover-type">${esc(LABELS[book.format] || LABELS.book)}</span></div>
      <div class="book-info"><span class="book-type">${esc(LABELS[book.format] || LABELS.book)}</span><h3 class="book-title" title="${esc(book.title)}">${esc(book.title)}</h3><span class="book-author">${esc(book.author)}</span>${book.year || book.pages ? `<span class="book-detail">${[book.year, book.pages ? `${book.pages} oldal` : ''].filter(Boolean).map(esc).join(' · ')}</span>` : ''}<div class="book-meta"><span class="status-pill ${statusClass}">${esc(book.status || 'Olvasatlan')}</span>${listName ? `<span class="list-pill">${esc(listName)}</span>` : ''}${book.category ? `<span class="category-label">${esc(book.category)}</span>` : ''}</div></div>
      <div class="card-actions"><button class="card-action" type="button" data-action="edit" aria-label="${esc(book.title)} szerkesztése" title="Szerkesztés"><svg viewBox="0 0 24 24"><path d="m14 5 5 5M4 20l4.4-.9L19.2 8.3a2.1 2.1 0 0 0-3-3L5.4 16.1 4 20Z"/></svg></button><button class="card-action delete" type="button" data-action="delete" aria-label="${esc(book.title)} törlése" title="Törlés"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button></div>
    </article>`;
  }

  function emptyHTML(hasBooks) {
    const title = hasBooks ? 'Nincs ilyen könyv' : 'Még üres a polcod';
    const description = hasBooks ? 'Próbálj más keresést vagy módosítsd a szűrőket.' : 'Add hozzá az első könyvedet, e-könyvedet vagy hangoskönyvedet.';
    return `<div class="empty-state"><div class="empty-illustration" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M7 9c5-.9 9.3.2 13 3v19c-3.7-2.8-8-3.9-13-3V9Zm26 0c-5-.9-9.3.2-13 3v19c3.7-2.8 8-3.9 13-3V9Z"/><path d="M10 14c2-.2 4 .1 6 1m-6 4c2-.2 4 .1 6 1m8-5c2-.9 4-1.2 6-1m-6 5c2-.9 4-1.2 6-1"/></svg></div><h3>${title}</h3><p>${description}</p>${hasBooks ? '' : '<button class="button button-primary" type="button" data-empty-add>+ Hozzáadom az első könyvet</button>'}</div>`;
  }

  function render() {
    $('#totalCount').textContent = state.books.length;
    $('#readingCount').textContent = state.books.filter(book => book.status === 'Olvasom').length;
    $('#readCount').textContent = state.books.filter(book => book.status === 'Elolvastam').length;
    $('#allTabCount').textContent = state.books.length;
    $$('.filter-tab').forEach(button => {
      const active = button.dataset.status === state.status && state.listFilter === 'all';
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#customListTabs').innerHTML = `<button class="list-tab${state.listFilter === 'all' ? ' active' : ''}" type="button" data-list-id="all" aria-pressed="${state.listFilter === 'all'}">Minden saját lista</button>${state.lists.map(list => `<button class="list-tab${state.listFilter === list.id ? ' active' : ''}" type="button" data-list-id="${esc(list.id)}" aria-pressed="${state.listFilter === list.id}">${esc(list.name)} <span>${state.books.filter(book => book.customListId === list.id).length}</span></button>`).join('')}`;
    updateBookListOptions($('#bookList').value);
    const books = visibleBooks();
    $('#booksGrid').innerHTML = books.length ? books.map(cardHTML).join('') : emptyHTML(state.books.length > 0);
  }

  function updateBookListOptions(selected = $('#bookList').value) {
    const select = $('#bookList');
    if (!select) return;
    select.innerHTML = `<option value="">Nincs listán</option>${state.lists.map(list => `<option value="${esc(list.id)}">${esc(list.name)}</option>`).join('')}`;
    select.value = state.lists.some(list => list.id === selected) ? selected : '';
  }

  function openBook(book = null) {
    $('#bookForm').reset();
    $('#catalogSearchPanel').hidden = Boolean(book);
    $('#manualEntryDivider').hidden = Boolean(book);
    $('#catalogSearchMessage').textContent = '';
    $('#catalogResults').innerHTML = '';
    state.catalogResults = [];
    $('#bookId').value = book?.id || '';
    $('#bookTitle').value = book?.title || '';
    $('#bookAuthor').value = book?.author || '';
    $('#bookFormat').value = book?.format || 'book';
    $('#bookStatus').value = book?.status || 'Olvasatlan';
    $('#bookCategory').value = book?.category || '';
    $('#bookIsbn').value = book?.isbn || '';
    $('#bookPublisher').value = book?.publisher || '';
    $('#bookYear').value = book?.year || '';
    $('#bookPages').value = book?.pages || '';
    $('#bookCoverUrl').value = book?.coverUrl || '';
    updateBookListOptions(book?.customListId || state.lists[0]?.id || '');
    $('#metadataMessage').textContent = '';
    $('#bookNotes').value = book?.notes || '';
    $('#bookDialogTitle').textContent = book ? 'Könyv szerkesztése' : 'Új könyv';
    $('#bookDialog').showModal();
    setTimeout(() => $('#bookTitle').focus(), 0);
  }

  function renderListsEditor() {
    $('#listsEditor').innerHTML = state.lists.length ? state.lists.map(list => {
      const bookCount = state.books.filter(book => book.customListId === list.id).length;
      return `<div class="list-editor-row" data-list-id="${esc(list.id)}"><label class="field"><span>Lista neve · ${bookCount} könyv</span><input data-list-name maxlength="60" value="${esc(list.name)}" /></label><div class="list-editor-actions"><button class="button button-quiet" type="button" data-list-save>Mentés</button><button class="button button-danger" type="button" data-list-delete ${state.lists.length === 1 ? 'disabled title="Legalább egy saját lista maradjon."' : ''}>Törlés</button></div></div>`;
    }).join('') : '<p class="no-lists-message">Még nincs saját listád. Adj hozzá egyet fent.</p>';
  }

  function openListsDialog() {
    renderListsEditor();
    $('#newListName').value = '';
    $('#listsDialog').showModal();
  }

  function duplicateListName(name, exceptId = '') {
    return state.lists.some(list => list.id !== exceptId && list.name.toLocaleLowerCase('hu') === name.toLocaleLowerCase('hu'));
  }

  async function createCustomList(event) {
    event.preventDefault();
    const name = $('#newListName').value.trim();
    if (!name) return;
    if (duplicateListName(name)) return toast('Már van ilyen nevű listád.');
    if (state.lists.length >= 30) return toast('Legfeljebb 30 saját listát hozhatsz létre.');
    const button = $('#newListForm button[type="submit"]');
    button.disabled = true;
    try {
      let list = { id: createId(), name };
      if (state.mode === 'cloud' && state.user) {
        const client = await getClient();
        const { data, error } = await client.from('book_lists').insert({ id: list.id, user_id: state.user.id, name: list.name }).select().single();
        if (error) throw error;
        list = { id: data.id, name: data.name };
      }
      state.lists = [...state.lists, list];
      if (state.mode === 'cloud') saveCloudListsCache(); else saveLocalLists();
      $('#newListName').value = '';
      render(); renderListsEditor();
      toast('Az új lista elkészült.');
    } catch (error) {
      console.error(error);
      toast(error?.code === '42P01' || /book_lists/i.test(error?.message || '') ? 'A saját listákhoz frissítsd az adatbázist az új útmutató szerint.' : 'Nem sikerült létrehozni a listát.');
    } finally { button.disabled = false; }
  }

  async function renameCustomList(row) {
    const id = row.dataset.listId;
    const list = state.lists.find(item => item.id === id);
    const name = row.querySelector('[data-list-name]').value.trim();
    if (!list || !name) return toast('A lista neve nem lehet üres.');
    if (duplicateListName(name, id)) return toast('Már van ilyen nevű listád.');
    if (name === list.name) return toast('A lista neve nem változott.');
    const button = row.querySelector('[data-list-save]');
    button.disabled = true;
    try {
      if (state.mode === 'cloud' && state.user) {
        const client = await getClient();
        const { error } = await client.from('book_lists').update({ name }).eq('id', id);
        if (error) throw error;
      }
      state.lists = state.lists.map(item => item.id === id ? { ...item, name } : item);
      if (state.mode === 'cloud') saveCloudListsCache(); else saveLocalLists();
      render(); renderListsEditor();
      toast('A lista neve frissült.');
    } catch (error) {
      console.error(error);
      toast(error?.code === '42P01' || /book_lists/i.test(error?.message || '') ? 'A saját listákhoz frissítsd az adatbázist az új útmutató szerint.' : 'Nem sikerült átnevezni a listát.');
    } finally { button.disabled = false; }
  }

  async function deleteCustomList(row) {
    const id = row.dataset.listId;
    const list = state.lists.find(item => item.id === id);
    if (!list) return;
    if (state.lists.length === 1) return toast('Legalább egy saját listát meg kell tartani.');
    const assigned = state.books.filter(book => book.customListId === id).length;
    if (!confirm(`Törlöd a(z) „${list.name}” listát?${assigned ? ` ${assigned} könyv lekerül róla, de a könyvtáradból nem törlődik.` : ''}`)) return;
    const button = row.querySelector('[data-list-delete]');
    button.disabled = true;
    try {
      if (state.mode === 'cloud' && state.user) {
        const client = await getClient();
        const { error } = await client.from('book_lists').delete().eq('id', id);
        if (error) throw error;
      }
      state.books = state.books.map(book => book.customListId === id ? { ...book, customListId: '' } : book);
      state.lists = state.lists.filter(item => item.id !== id);
      if (state.listFilter === id) state.listFilter = 'all';
      if (state.mode === 'cloud') saveCloudCache(); else saveLocal();
      if (state.mode === 'cloud') saveCloudListsCache(); else saveLocalLists();
      render(); renderListsEditor();
      toast('A lista törölve; a könyveid megmaradtak.');
    } catch (error) {
      console.error(error);
      toast(error?.code === '42P01' || /book_lists/i.test(error?.message || '') ? 'A saját listákhoz frissítsd az adatbázist az új útmutató szerint.' : 'Nem sikerült törölni a listát.');
    } finally { button.disabled = false; }
  }

  function normalizeIsbn(value) { return String(value || '').replace(/[^0-9X]/gi, '').toUpperCase(); }
  function foldSearchText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').replace(/\s+/g, ' ').trim();
  }
  function normalizeHungarianBookQuery(value) {
    return String(value || '').replace(/\S+/gu, word => word.replace(/(ás|és)t$/iu, '$1')).replace(/\s+/g, ' ').trim();
  }
  function isValidIsbn(value) {
    if (/^97[89]\d{10}$/.test(value)) {
      const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
      return (10 - sum % 10) % 10 === Number(value[12]);
    }
    if (/^\d{9}[\dX]$/.test(value)) {
      const sum = [...value.slice(0, 9)].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
      const check = (11 - sum % 11) % 11;
      return value[9] === (check === 10 ? 'X' : String(check));
    }
    return false;
  }
  function getYear(value) { return String(value || '').match(/(?:1[0-9]{3}|20[0-9]{2}|2100)/)?.[0] || ''; }

  function languageName(value) {
    const code = String(Array.isArray(value) ? value[0] : value || '').split('/').pop().toLowerCase();
    const names = { hu: 'magyar', hun: 'magyar', en: 'angol', eng: 'angol', de: 'német', ger: 'német', deu: 'német', fr: 'francia', fre: 'francia', fra: 'francia', es: 'spanyol', spa: 'spanyol', it: 'olasz', ita: 'olasz', pl: 'lengyel', pol: 'lengyel', ru: 'orosz', rus: 'orosz', cs: 'cseh', cze: 'cseh', ces: 'cseh', sk: 'szlovák', slo: 'szlovák', slk: 'szlovák' };
    return names[code] || (code ? code.toUpperCase() : '');
  }

  function googleCandidate(item, source = 'Google Books') {
    const volume = item.volumeInfo || {};
    const identifiers = volume.industryIdentifiers || [];
    const isbn = identifiers.find(identifier => identifier.type === 'ISBN_13')?.identifier || identifiers.find(identifier => identifier.type === 'ISBN_10')?.identifier || '';
    return {
      source,
      title: [volume.title, volume.subtitle].filter(Boolean).join(': '),
      author: Array.isArray(volume.authors) ? volume.authors.join(', ') : '',
      isbn,
      publisher: volume.publisher || '',
      year: getYear(volume.publishedDate),
      pages: volume.pageCount || '',
      coverUrl: safeCoverUrl(volume.imageLinks?.thumbnail?.replace(/^http:/i, 'https:') || ''),
      language: languageName(volume.language),
      sourceId: item.id || ''
    };
  }

  async function searchGoogleBooks(query, { hungarianOnly = false } = {}) {
    const params = new URLSearchParams({ q: query, maxResults: '20', printType: 'books' });
    if (hungarianOnly) params.set('langRestrict', 'hu');
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    if (!response.ok) throw new Error(`Google Books: ${response.status}`);
    const data = await response.json();
    return (data.items || []).map(item => googleCandidate(item, hungarianOnly ? 'Google Books · magyar nyelv' : 'Google Books')).filter(candidate => candidate.title);
  }

  async function searchOpenLibrary(query, { hungarianOnly = false } = {}) {
    const params = new URLSearchParams({
      lang: 'hu', limit: '20',
      fields: 'key,title,author_name,first_publish_year,cover_i,editions,editions.key,editions.title,editions.language'
    });
    params.set('q', hungarianOnly ? `${query} language:hun` : query);
    const response = await fetch(`https://openlibrary.org/search.json?${params}`);
    if (!response.ok) throw new Error(`Open Library: ${response.status}`);
    const data = await response.json();
    return (data.docs || []).flatMap(work => {
      const editions = work.editions?.docs || [];
      const authorName = Array.isArray(work.author_name) ? work.author_name.join(', ') : '';
      if (!editions.length) return [{
        source: hungarianOnly ? 'Open Library · magyar nyelv' : 'Open Library', title: work.title || '', author: authorName,
        year: getYear(work.first_publish_year),
        coverUrl: work.cover_i ? `https://covers.openlibrary.org/b/id/${work.cover_i}-M.jpg` : '',
        sourceId: work.key || '', language: '', editionKey: ''
      }];
      return editions.map(edition => ({
        source: hungarianOnly ? 'Open Library · magyar nyelv' : 'Open Library', title: edition.title || work.title || '', author: authorName,
        year: getYear(work.first_publish_year), language: languageName(edition.language),
        coverUrl: work.cover_i ? `https://covers.openlibrary.org/b/id/${work.cover_i}-M.jpg` : '',
        sourceId: edition.key || work.key || '', editionKey: edition.key || ''
      }));
    }).filter(candidate => candidate.title);
  }

  function escapeSparqlLiteral(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ');
  }

  async function searchMekBooks(query) {
    const words = [...new Set(query.split(/\s+/).map(word => word.trim()).filter(Boolean))].slice(0, 8);
    if (!words.length) return [];
    const matchingTerms = words.map(word => `CONTAINS(LCASE(?searchText), LCASE("${escapeSparqlLiteral(word)}"))`).join(' && ');
    const sparql = `PREFIX dcterms: <http://purl.org/dc/terms/>\nPREFIX bibo: <http://purl.org/ontology/bibo/>\nPREFIX foaf: <http://xmlns.com/foaf/0.1/>\nPREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\nSELECT DISTINCT ?record ?title ?author ?publisher ?published ?isbn ?language WHERE {\n  ?record dcterms:title ?title .\n  OPTIONAL { ?record dcterms:creator ?creator }\n  OPTIONAL { ?creator foaf:name ?creatorName }\n  OPTIONAL { ?creator rdfs:label ?creatorLabel }\n  BIND(COALESCE(STR(?creatorName), STR(?creatorLabel), IF(isLiteral(?creator), STR(?creator), "")) AS ?author)\n  OPTIONAL { ?record dcterms:publisher ?publisher }\n  OPTIONAL { ?record dcterms:issued ?issued }\n  OPTIONAL { ?record dcterms:date ?date }\n  BIND(COALESCE(STR(?issued), STR(?date), "") AS ?published)\n  OPTIONAL { ?record bibo:isbn ?isbn }\n  OPTIONAL { ?record dcterms:language ?language }\n  BIND(LCASE(CONCAT(STR(?title), " ", COALESCE(?author, ""), " ", COALESCE(STR(?creator), ""))) AS ?searchText)\n  FILTER(${matchingTerms})\n} LIMIT 20`;
    const params = new URLSearchParams({ query: sparql, format: 'application/sparql-results+json' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(`https://v.mek.oszk.hu/sparql?${params}`, { signal: controller.signal, headers: { Accept: 'application/sparql-results+json' } });
      if (!response.ok) throw new Error(`MEK (OSZK): ${response.status}`);
      const data = await response.json();
      const bindings = data.results?.bindings || [];
      return bindings.map(row => {
        const recordUrl = row.record?.value || '';
        const sourceUrl = recordUrl.replace('/data/', '/');
        return {
          source: 'MEK · OSZK', title: row.title?.value || '', author: row.author?.value || '',
          publisher: row.publisher?.value || '', year: getYear(row.published?.value),
          isbn: normalizeIsbn(row.isbn?.value), language: languageName(row.language?.value), sourceId: recordUrl,
          sourceUrl: /^https:\/\/mek\.oszk\.hu\//i.test(sourceUrl) ? sourceUrl : ''
        };
      }).filter(candidate => candidate.title);
    } finally {
      clearTimeout(timeout);
    }
  }

  function catalogCandidatesMatch(left, right) {
    const leftIsbn = normalizeIsbn(left.isbn);
    const rightIsbn = normalizeIsbn(right.isbn);
    if (leftIsbn && rightIsbn) return leftIsbn === rightIsbn;
    const sameText = (a, b) => normalizedMatchText(a) === normalizedMatchText(b);
    if (!left.title || !right.title || !sameText(left.title, right.title)) return false;
    if (left.author && right.author && !sameText(left.author, right.author)) return false;
    return ['year', 'publisher', 'language'].every(field => !left[field] || !right[field] || sameText(left[field], right[field]));
  }

  function mergeCatalogCandidates(groups) {
    const candidates = [];
    for (const candidate of groups.flat()) {
      const existingIndex = candidates.findIndex(existing => catalogCandidatesMatch(existing, candidate));
      if (existingIndex === -1) {
        candidates.push(candidate);
      } else {
        const existing = candidates[existingIndex];
        const merged = Object.fromEntries(Object.entries(existing).map(([field, value]) => [field, value || candidate[field]]));
        if (!existing.source.includes(candidate.source)) merged.source = `${existing.source} + ${candidate.source}`;
        candidates[existingIndex] = merged;
      }
    }
    return candidates;
  }

  function renderCatalogResults() {
    $('#catalogResults').innerHTML = state.catalogResults.map((candidate, index) => {
      const details = [candidate.language, candidate.publisher, candidate.year, candidate.isbn ? `ISBN ${candidate.isbn}` : ''].filter(Boolean).join(' · ');
      return `<div class="catalog-result-wrap"><button class="catalog-result" type="button" data-catalog-index="${index}"><span class="catalog-result-copy"><strong>${esc(candidate.title)}</strong><span>${esc(candidate.author || 'A szerző nem szerepel az adatbázisban')}</span><small>${esc(details || 'A kiadás további adatai kiválasztás után kérhetők le')}</small></span><span class="catalog-result-source">${esc(candidate.source)}</span></button>${candidate.sourceUrl ? `<a class="catalog-source-link" href="${esc(candidate.sourceUrl)}" target="_blank" rel="noopener noreferrer">MEK-rekord ↗</a>` : ''}</div>`;
    }).join('');
  }

  async function searchCatalogBooks() {
    const query = $('#catalogQuery').value.trim();
    if (!query) {
      $('#catalogSearchMessage').textContent = 'Írd be a könyv címét, a szerzőt vagy mindkettőt.';
      $('#catalogQuery').focus();
      return;
    }
    const button = $('#searchCatalogButton');
    button.disabled = true;
    button.textContent = 'Keresés…';
    $('#catalogSearchMessage').textContent = 'Keresés a könyvkatalógusokban…';
    $('#catalogResults').innerHTML = '';
    state.catalogResults = [];
    const normalizedQuery = normalizeHungarianBookQuery(query);
    const accentFoldedQuery = foldSearchText(normalizedQuery);
    const searches = [
      { name: 'Google Books magyar nyelvű', run: () => searchGoogleBooks(normalizedQuery, { hungarianOnly: true }) },
      { name: 'MEK (OSZK)', run: () => searchMekBooks(normalizedQuery) },
      { name: 'Open Library magyar nyelvű', run: () => searchOpenLibrary(normalizedQuery, { hungarianOnly: true }) },
      { name: 'Google Books', run: () => searchGoogleBooks(accentFoldedQuery) },
      { name: 'Open Library', run: () => searchOpenLibrary(accentFoldedQuery) }
    ];
    const results = await Promise.allSettled(searches.map(search => search.run()));
    const successfulGroups = results.filter(result => result.status === 'fulfilled').map(result => result.value);
    const unavailableSources = results.flatMap((result, index) => result.status === 'rejected' ? [searches[index].name] : []);
    const googleUnavailable = results.some((result, index) => result.status === 'rejected' && searches[index].name.startsWith('Google Books'));
    const molySearchLink = $('#molySearchLink');
    molySearchLink.href = `https://moly.hu/kereses?q=${encodeURIComponent(normalizedQuery || query)}`;
    molySearchLink.hidden = false;
    state.catalogResults = mergeCatalogCandidates(successfulGroups);
    renderCatalogResults();
    if (state.catalogResults.length) {
      $('#catalogSearchMessage').textContent = `${state.catalogResults.length} találat. Válaszd ki a megfelelő nyelvet, kiadást vagy ISBN-t.${unavailableSources.length ? ` Nem válaszolt: ${[...new Set(unavailableSources)].join(', ')}.` : ''}${googleUnavailable ? ' A Google Books most nem érhető el, ezért magyar címekből kevesebb találat jelenhet meg.' : ''}`;
    } else if (!successfulGroups.length) {
      $('#catalogSearchMessage').textContent = `Most nem sikerült elérni a könyvkatalógusokat.${googleUnavailable ? ' A Google Books jelenleg nem válaszol.' : ''} Ellenőrizd az internetet, vagy keresd meg a magyar kiadást a Molyon az alábbi hivatkozással.`;
    } else {
      $('#catalogSearchMessage').textContent = `Nem találtam egyezést.${googleUnavailable ? ' A Google Books most nem érhető el, az Open Library pedig nem tartalmazza ezt a magyar kiadást.' : ' Próbáld meg az eredeti címet, vagy add meg kézzel az adatokat.'}`;
    }
    button.disabled = false;
    button.textContent = 'Könyvek keresése';
  }

  async function openLibraryEditionMetadata(candidate) {
    if (!candidate.editionKey) return candidate;
    const response = await fetch(`https://openlibrary.org${candidate.editionKey}.json`);
    if (!response.ok) return candidate;
    const edition = await response.json();
    const isbn = edition.isbn_13?.[0] || edition.isbn_10?.[0] || '';
    const coverId = edition.covers?.[0];
    return {
      ...candidate,
      title: [edition.title, edition.subtitle].filter(Boolean).join(': ') || candidate.title,
      isbn: isbn || candidate.isbn || '',
      publisher: edition.publishers?.[0] || candidate.publisher || '',
      year: getYear(edition.publish_date) || candidate.year || '',
      pages: edition.number_of_pages || candidate.pages || '',
      coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : candidate.coverUrl,
      language: languageName(edition.languages?.[0]?.key) || candidate.language
    };
  }

  async function selectCatalogBook(index) {
    const candidate = state.catalogResults[index];
    if (!candidate) return;
    const button = $(`[data-catalog-index="${index}"]`, $('#catalogResults'));
    if (button) button.disabled = true;
    $('#catalogSearchMessage').textContent = `A kiadás adatainak betöltése (${candidate.source})…`;
    let metadata = candidate;
    if (candidate.editionKey) {
      try { metadata = await openLibraryEditionMetadata(candidate); }
      catch (error) { console.warn('Az Open Library kiadásadatai nem érhetők el.', error); }
    }
    const fields = { title: '#bookTitle', author: '#bookAuthor', publisher: '#bookPublisher', year: '#bookYear', pages: '#bookPages', coverUrl: '#bookCoverUrl' };
    for (const [key, selector] of Object.entries(fields)) {
      if (metadata[key]) $(selector).value = metadata[key];
    }
    if (metadata.isbn) $('#bookIsbn').value = normalizeIsbn(metadata.isbn);
    const source = candidate.source || 'könyvkatalógus';
    $('#metadataMessage').textContent = `Kiválasztott kiadás (${source}). Ellenőrizd az adatokat, és lent válaszd ki, hogy könyvként, e-könyvként vagy hangoskönyvként tartod nyilván.`;
    $('#catalogSearchMessage').textContent = `Betöltve: ${metadata.title || candidate.title}`;
    if (button) button.disabled = false;
    $('#bookTitle').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  async function googleBooksMetadata(isbn) {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&maxResults=5`);
    if (!response.ok) throw new Error(`Google Books: ${response.status}`);
    const result = await response.json();
    const volume = result.items?.[0]?.volumeInfo;
    if (!volume) return null;
    return {
      title: volume.title || '', author: Array.isArray(volume.authors) ? volume.authors.join(', ') : '',
      publisher: volume.publisher || '', year: getYear(volume.publishedDate), pages: volume.pageCount || '',
      coverUrl: volume.imageLinks?.thumbnail?.replace(/^http:/i, 'https:') || ''
    };
  }

  async function openLibraryMetadata(isbn) {
    const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Open Library: ${response.status}`);
    const edition = await response.json();
    const authorNames = await Promise.all((edition.authors || []).slice(0, 4).map(async author => {
      if (author.name) return author.name;
      if (!author.key) return '';
      try {
        const authorResponse = await fetch(`https://openlibrary.org${author.key}.json`);
        if (!authorResponse.ok) return '';
        return (await authorResponse.json()).name || '';
      } catch { return ''; }
    }));
    const coverId = edition.covers?.[0];
    return {
      title: [edition.title, edition.subtitle].filter(Boolean).join(': '),
      author: authorNames.filter(Boolean).join(', '),
      publisher: edition.publishers?.[0] || '', year: getYear(edition.publish_date),
      pages: edition.number_of_pages || '', coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : ''
    };
  }

  async function lookupBookMetadata() {
    const isbn = normalizeIsbn($('#bookIsbn').value);
    $('#metadataMessage').textContent = '';
    if (!isValidIsbn(isbn)) {
      $('#metadataMessage').textContent = 'Írj be egy érvényes ISBN-10 vagy ISBN-13 számot.';
      $('#bookIsbn').focus();
      return;
    }
    $('#bookIsbn').value = isbn;
    const button = $('#lookupIsbnButton');
    button.disabled = true;
    button.textContent = 'Keresés…';
    $('#metadataMessage').textContent = 'Keresés a könyvkatalógusokban…';
    let metadata = null;
    let providerCount = 0;
    try {
      try { metadata = await googleBooksMetadata(isbn); if (metadata) providerCount++; }
      catch (error) { console.warn('Google Books nem válaszolt.', error); }
      const incomplete = !metadata || !metadata.title || !metadata.author || !metadata.publisher || !metadata.year || !metadata.pages || !metadata.coverUrl;
      if (incomplete) {
        try {
          const fallback = await openLibraryMetadata(isbn);
          if (fallback) {
            providerCount++;
            metadata = Object.fromEntries(Object.entries(fallback).map(([key, value]) => [key, metadata?.[key] || value]));
          }
        } catch (error) { console.warn('Open Library nem válaszolt.', error); }
      }
      if (!metadata || !Object.values(metadata).some(Boolean)) {
        $('#metadataMessage').textContent = 'Nem találtam adatot ehhez az ISBN-hez. A könyv adatait kézzel is megadhatod.';
        return;
      }
      const fields = { title: '#bookTitle', author: '#bookAuthor', publisher: '#bookPublisher', year: '#bookYear', pages: '#bookPages', coverUrl: '#bookCoverUrl' };
      for (const [key, selector] of Object.entries(fields)) {
        if (metadata[key]) $(selector).value = metadata[key];
      }
      if (metadata.title || metadata.author) $('#bookFormat').value = $('#bookFormat').value || 'book';
      $('#metadataMessage').textContent = `Talált adatok (${providerCount === 2 ? 'Google Books és Open Library' : providerCount === 1 ? 'könyvkatalógus' : 'részleges találat'}). Mentés előtt ellenőrizd őket.`;
    } finally {
      button.disabled = false;
      button.textContent = 'Adatok keresése';
    }
  }

  function stopScanner() {
    state.scannerActive = false;
    state.scannerBusy = false;
    if (state.scannerFrame) cancelAnimationFrame(state.scannerFrame);
    state.scannerFrame = 0;
    state.scannerStream?.getTracks().forEach(track => track.stop());
    state.scannerStream = null;
    const video = $('#isbnVideo');
    if (video) video.srcObject = null;
  }

  function closeScanner() {
    stopScanner();
    if ($('#scannerDialog').open) $('#scannerDialog').close();
  }

  async function startScanner() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      toast('A kamerás beolvasáshoz HTTPS-kapcsolat és kameraengedély szükséges.');
      return;
    }
    if (!('BarcodeDetector' in window)) {
      toast('Ez a böngésző nem támogatja a vonalkód felismerést. Próbáld meg friss Chrome-ban, vagy írd be az ISBN-t.');
      return;
    }
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      if (!formats.includes('ean_13')) {
        toast('Ez a böngésző nem tudja olvasni a könyvek ISBN-vonalkódját. Írd be az ISBN-t kézzel.');
        return;
      }
      const detector = new BarcodeDetector({ formats: ['ean_13'] });
      $('#scannerDialog').showModal();
      state.scannerStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } });
      const video = $('#isbnVideo');
      video.srcObject = state.scannerStream;
      await video.play();
      state.scannerActive = true;
      const scanFrame = async () => {
        if (!state.scannerActive) return;
        if (!state.scannerBusy && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          state.scannerBusy = true;
          try {
            const codes = await detector.detect(video);
            const isbn = normalizeIsbn(codes.find(code => code.format === 'ean_13')?.rawValue || '');
            if (isbn.startsWith('978') || isbn.startsWith('979')) {
              stopScanner();
              if ($('#scannerDialog').open) $('#scannerDialog').close();
              $('#bookIsbn').value = isbn;
              $('#metadataMessage').textContent = 'ISBN beolvasva. Könyvadatok keresése…';
              await lookupBookMetadata();
              return;
            }
          } catch (error) { console.warn('A vonalkód beolvasása nem sikerült.', error); }
          finally { state.scannerBusy = false; }
        }
        if (state.scannerActive) state.scannerFrame = requestAnimationFrame(scanFrame);
      };
      state.scannerFrame = requestAnimationFrame(scanFrame);
    } catch (error) {
      console.warn('A kamerát nem sikerült elindítani.', error);
      closeScanner();
      toast(error?.name === 'NotAllowedError' ? 'Engedélyezd a kamera használatát a böngészőben.' : 'Nem sikerült elindítani a kamerát. Ellenőrizd a telefon kameraengedélyeit.');
    }
  }

  function validateConfig(url, key) {
    try {
      const parsed = new URL(url);
      if (!(parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))) return false;
      return Boolean(key.trim());
    } catch { return false; }
  }

  async function getClient() {
    if (!state.config?.url || !state.config?.key) throw new Error('Előbb add meg és mentsd el a Supabase projekt URL-jét és a publikus kulcsot.');
    if (!state.client) {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      state.client = createClient(state.config.url, state.config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      state.client.auth.onAuthStateChange((_event, session) => {
        state.user = session?.user || null;
        if (state.user) {
          state.mode = 'cloud';
          setConnection(navigator.onLine ? 'cloud' : 'offline', navigator.onLine ? 'Online könyvtár' : 'Kapcsolat nélkül');
        } else if (state.mode === 'cloud') {
          state.mode = 'local';
          state.books = readLocal();
          state.lists = readLocalLists();
          setConnection('local', 'Helyi tárhely');
          render();
        }
        updateSettingsView();
      });
    }
    return state.client;
  }

  function rowToBook(row) {
    return { id: row.id, title: row.title, author: row.author, format: row.format, status: row.status, category: row.category || '', isbn: row.isbn || '', publisher: row.publisher || '', year: row.publication_year || '', pages: row.page_count || '', coverUrl: row.cover_url || '', customListId: row.custom_list_id || '', notes: row.notes || '', addedAt: row.created_at, updatedAt: row.updated_at };
  }
  function bookToRow(book) {
    const now = new Date().toISOString();
    return { id: book.id, user_id: state.user.id, title: book.title, author: book.author, format: book.format, status: book.status, category: book.category || null, isbn: book.isbn || null, publisher: book.publisher || null, publication_year: book.year ? Number(book.year) : null, page_count: book.pages ? Number(book.pages) : null, cover_url: book.coverUrl || null, custom_list_id: book.customListId || null, notes: book.notes || null, created_at: book.addedAt || now, updated_at: now };
  }

  function rowToList(row) { return { id: row.id, name: row.name }; }
  function listToRow(list) { return { id: list.id, user_id: state.user.id, name: list.name }; }

  function normalizedMatchText(value) { return foldSearchText(value); }
  function sameBookRecord(left, right) {
    if (!left || !right || (left.format || 'book') !== (right.format || 'book')) return false;
    const leftIsbn = normalizeIsbn(left.isbn);
    const rightIsbn = normalizeIsbn(right.isbn);
    if (leftIsbn && rightIsbn) return leftIsbn === rightIsbn;
    return normalizedMatchText(left.title) === normalizedMatchText(right.title)
      && normalizedMatchText(left.author) === normalizedMatchText(right.author);
  }

  async function mergeLocalListsIntoCloud(localLists) {
    const client = await getClient();
    const { data, error } = await client.from('book_lists').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    const cloudLists = (data || []).map(rowToList);
    const idMap = new Map();
    for (const localList of localLists) {
      let cloudList = cloudLists.find(list => normalizedMatchText(list.name) === normalizedMatchText(localList.name));
      if (!cloudList) {
        const { data: inserted, error: insertError } = await client.from('book_lists')
          .insert({ id: createId(), user_id: state.user.id, name: localList.name })
          .select().single();
        if (insertError?.code === '23505') {
          const { data: refreshed, error: refreshError } = await client.from('book_lists').select('*').order('created_at', { ascending: true });
          if (refreshError) throw refreshError;
          cloudLists.splice(0, cloudLists.length, ...(refreshed || []).map(rowToList));
          cloudList = cloudLists.find(list => normalizedMatchText(list.name) === normalizedMatchText(localList.name));
        } else if (insertError) {
          throw insertError;
        } else {
          cloudList = rowToList(inserted);
          cloudLists.push(cloudList);
        }
      }
      if (cloudList) idMap.set(localList.id, cloudList.id);
    }
    state.lists = cloudLists;
    saveCloudListsCache();
    return idMap;
  }

  async function mergeLocalBooksIntoCloud(localBooks, listIdMap) {
    if (!localBooks.length) return 0;
    const remoteBooks = [...state.books];
    const changes = [];
    for (const localBook of localBooks) {
      const local = { ...localBook, customListId: listIdMap.get(localBook.customListId) || '' };
      const match = remoteBooks.find(book => book.id === local.id) || remoteBooks.find(book => sameBookRecord(book, local));
      if (match) {
        const localUpdated = Date.parse(local.updatedAt || local.addedAt || '') || 0;
        const remoteUpdated = Date.parse(match.updatedAt || match.addedAt || '') || 0;
        if (localUpdated > remoteUpdated) {
          const updated = { ...local, id: match.id, addedAt: match.addedAt || local.addedAt };
          changes.push(updated);
          remoteBooks[remoteBooks.indexOf(match)] = updated;
        }
        continue;
      }
      const idInUse = remoteBooks.some(book => book.id === local.id);
      const added = { ...local, id: idInUse ? createId() : local.id };
      changes.push(added);
      remoteBooks.push(added);
    }
    if (!changes.length || !confirm(`Ezen az eszközön ${changes.length} olyan helyi könyv van, amely még nincs naprakészen a közös könyvtárban. Hozzáadjam vagy frissítsem őket? Az azonos könyvek nem kerülnek be kétszer.`)) return 0;
    const client = await getClient();
    const { error } = await client.from('books').upsert(changes.map(bookToRow), { onConflict: 'id' });
    if (error) throw error;
    return changes.length;
  }

  async function mergeLocalLibraryIntoCloud(localBooks, localLists) {
    const listIdMap = await mergeLocalListsIntoCloud(localLists);
    const changedBooks = await mergeLocalBooksIntoCloud(localBooks, listIdMap);
    if (changedBooks) await refreshCloud();
    else render();
  }

  async function refreshCloud() {
    const client = await getClient();
    if (!state.user) return;
    setConnection(navigator.onLine ? 'cloud' : 'offline', navigator.onLine ? 'Szinkronizálás…' : 'Kapcsolat nélkül');
    const { data, error } = await client.from('books').select('*').order('updated_at', { ascending: false });
    if (error) {
      setConnection('offline', 'Szinkronizálási hiba');
      throw new Error('Nem sikerült beolvasni a közös könyvtárat. Ellenőrizd az adatbázist és az internetkapcsolatot.');
    }
    const { data: listData, error: listError } = await client.from('book_lists').select('*').order('created_at', { ascending: true });
    if (listError) {
      setConnection('offline', 'Adatbázis-frissítés kell');
      throw new Error('A könyvtárhoz szükséges adatbázis-frissítést még nem futtattad le. Nyisd meg a projekt README útmutatóját.');
    }
    if (!listData?.length) {
      const localLists = state.lists.length ? state.lists : readLocalLists();
      const { error: seedError } = await client.from('book_lists').upsert(localLists.map(listToRow), { onConflict: 'id' });
      if (seedError) throw new Error('Nem sikerült feltölteni a saját listákat. Frissítsd az adatbázist az új útmutató szerint.');
      state.lists = localLists;
    } else {
      state.lists = listData.map(rowToList);
    }
    state.books = (data || []).map(rowToBook);
    state.mode = 'cloud';
    saveCloudCache();
    saveCloudListsCache();
    setConnection('cloud', 'Online könyvtár');
    render();
  }

  async function saveBookFromForm(event) {
    event.preventDefault();
    const id = $('#bookId').value || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    const existing = state.books.find(book => book.id === id);
    const book = {
      id,
      title: $('#bookTitle').value.trim(),
      author: $('#bookAuthor').value.trim(),
      format: $('#bookFormat').value,
      status: $('#bookStatus').value,
      category: $('#bookCategory').value.trim(),
      isbn: $('#bookIsbn').value.trim(),
      publisher: $('#bookPublisher').value.trim(),
      year: $('#bookYear').value.trim(),
      pages: $('#bookPages').value.trim(),
      coverUrl: safeCoverUrl($('#bookCoverUrl').value.trim()),
      customListId: $('#bookList').value,
      notes: $('#bookNotes').value.trim(),
      addedAt: existing?.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!book.title || !book.author) return;
    const button = $('#bookForm button[type="submit"]');
    button.disabled = true;
    try {
      if (state.mode === 'cloud' && state.user) {
        const client = await getClient();
        const result = existing
          ? await client.from('books').update(bookToRow(book)).eq('id', id).select().single()
          : await client.from('books').insert(bookToRow(book)).select().single();
        if (result.error) throw result.error;
        const saved = rowToBook(result.data);
        state.books = [saved, ...state.books.filter(item => item.id !== id)];
        saveCloudCache();
        setConnection('cloud', 'Online könyvtár');
      } else {
        state.books = [book, ...state.books.filter(item => item.id !== id)];
        saveLocal();
      }
      $('#bookDialog').close();
      render();
      toast(existing ? 'A könyv adatai frissültek.' : 'A könyv felkerült a polcra.');
    } catch (error) {
      console.error(error);
      toast(/column|book_lists|custom_list_id|publication_year|page_count/i.test(error?.message || '') ? 'Az adatbázist frissíteni kell. Futtasd le az új schema.sql-t.' : error?.message?.includes('books') ? 'Nem érhető el az adatbázis. Futtasd a beállítási SQL-t.' : 'Nem sikerült menteni. Ellenőrizd az internetkapcsolatot és a beállításokat.');
    } finally { button.disabled = false; }
  }

  async function deleteBook(id) {
    const book = state.books.find(item => item.id === id);
    if (!book || !confirm(`Törlöd a „${book.title}” című könyvet?`)) return;
    try {
      if (state.mode === 'cloud' && state.user) {
        const client = await getClient();
        const { error } = await client.from('books').delete().eq('id', id);
        if (error) throw error;
        state.books = state.books.filter(item => item.id !== id);
        saveCloudCache();
      } else {
        state.books = state.books.filter(item => item.id !== id);
        saveLocal();
      }
      render();
      toast('A könyv törölve.');
    } catch (error) {
      console.error(error);
      toast('Nem sikerült törölni. Ellenőrizd az internetkapcsolatot.');
    }
  }

  async function authenticate(mode) {
    const localBooks = readLocal();
    const localLists = readLocalLists();
    const url = $('#projectUrl').value.trim();
    const key = $('#publicKey').value.trim();
    if (!validateConfig(url, key)) {
      toast('Add meg a megfelelő Supabase projekt URL-t és publikus kulcsot, majd mentsd el.');
      $('#projectUrl').focus();
      return;
    }
    state.config = { url, key };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
    state.client = null;
    try {
      const client = await getClient();
      const credentials = { email: $('#accountEmail').value.trim(), password: $('#accountPassword').value };
      const result = mode === 'signup' ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
      if (result.error) throw result.error;
      if (!result.data.session) {
        toast('Nézd meg az e-mailjeidet, és erősítsd meg a fiókot a bejelentkezéshez.');
        return;
      }
      state.user = result.data.user;
      state.mode = 'cloud';
      state.books = readCloudCache(state.user.id);
      setConnection('cloud', 'Online könyvtár');
      updateSettingsView();
      await refreshCloud();
      let mergeFailed = false;
      try { await mergeLocalLibraryIntoCloud(localBooks, localLists); }
      catch (mergeError) { mergeFailed = true; console.error(mergeError); }
      $('#settingsDialog').close();
      toast(mergeFailed ? 'Bejelentkeztél, de a helyi könyvek vagy listák összefésülése nem sikerült. A helyi adatok megmaradtak ezen az eszközön.' : mode === 'signup' ? 'Fiók létrehozva, könyvtár szinkronizálva.' : 'Bejelentkezve, könyvtár szinkronizálva.');
    } catch (error) {
      console.error(error);
      const message = /Invalid login credentials/i.test(error?.message || '') ? 'Hibás e-mail-cím vagy jelszó.' : /fetch|network/i.test(error?.message || '') ? 'Nem érhető el a szolgáltatás. Ellenőrizd a projekt URL-t és az internetet.' : error?.message || 'Nem sikerült bejelentkezni.';
      toast(message);
    }
  }

  function exportLibrary() {
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), books: state.books, lists: state.lists }, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `polc-konyvtar-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast('A könyvtár mentése elkészült.');
  }

  function setupEvents() {
    $('#addBookButton').addEventListener('click', () => openBook());
    $('#booksGrid').addEventListener('click', event => {
      if (event.target.closest('[data-empty-add]')) return openBook();
      const action = event.target.closest('[data-action]');
      if (!action) return;
      const id = action.closest('[data-book-id]').dataset.bookId;
      if (action.dataset.action === 'edit') openBook(state.books.find(book => book.id === id));
      if (action.dataset.action === 'delete') deleteBook(id);
    });
    $('#bookForm').addEventListener('submit', saveBookFromForm);
    $('#lookupIsbnButton').addEventListener('click', lookupBookMetadata);
    $('#searchCatalogButton').addEventListener('click', searchCatalogBooks);
    $('#catalogQuery').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); searchCatalogBooks(); } });
    $('#catalogResults').addEventListener('click', event => {
      const result = event.target.closest('[data-catalog-index]');
      if (result) selectCatalogBook(Number(result.dataset.catalogIndex));
    });
    $('#scanIsbnButton').addEventListener('click', startScanner);
    $('#manageListsButton').addEventListener('click', openListsDialog);
    $('#newListForm').addEventListener('submit', createCustomList);
    $('#listsEditor').addEventListener('click', event => {
      const row = event.target.closest('[data-list-id]');
      if (!row) return;
      if (event.target.closest('[data-list-save]')) renameCustomList(row);
      if (event.target.closest('[data-list-delete]')) deleteCustomList(row);
    });
    $('#customListTabs').addEventListener('click', event => {
      const tab = event.target.closest('[data-list-id]');
      if (!tab) return;
      state.listFilter = tab.dataset.listId;
      state.status = 'all';
      render();
    });
    $('#stopScannerButton').addEventListener('click', closeScanner);
    $('#cancelScannerButton').addEventListener('click', closeScanner);
    $('#scannerDialog').addEventListener('cancel', stopScanner);
    $('#scannerDialog').addEventListener('close', stopScanner);
    $('#searchInput').addEventListener('input', event => { state.query = event.target.value; render(); });
    $('#formatFilter').addEventListener('change', event => { state.format = event.target.value; render(); });
    $$('.filter-tab').forEach(button => button.addEventListener('click', () => { state.status = button.dataset.status; state.listFilter = 'all'; render(); }));
    $('#settingsButton').addEventListener('click', () => { updateSettingsView(); $('#settingsDialog').showModal(); });
    $$('[data-close]').forEach(button => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
    $('#configForm').addEventListener('submit', event => {
      event.preventDefault();
      const url = $('#projectUrl').value.trim();
      const key = $('#publicKey').value.trim();
      if (!validateConfig(url, key)) return toast('Ellenőrizd a projekt URL-t és a publikus kulcsot.');
      state.config = { url, key };
      state.client = null;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config));
      toast('A szolgáltatás beállításai elmentve.');
    });
    $('#authForm').addEventListener('submit', event => { event.preventDefault(); authenticate(event.submitter?.dataset.auth || 'login'); });
    $('#syncNowButton').addEventListener('click', async () => {
      try { await refreshCloud(); toast('A könyvtár naprakész.'); }
      catch (error) { toast(error.message); }
    });
    $('#signOutButton').addEventListener('click', async () => {
      try {
        const client = await getClient();
        const { error } = await client.auth.signOut();
        if (error) throw error;
        state.user = null;
        state.mode = 'local';
        state.books = readLocal();
        state.lists = readLocalLists();
        setConnection('local', 'Helyi tárhely');
        updateSettingsView(); render();
        toast('Kijelentkeztél.');
      } catch { toast('Nem sikerült kijelentkezni.'); }
    });
    $('#exportButton').addEventListener('click', exportLibrary);
    window.addEventListener('online', () => { if (state.user) refreshCloud().catch(() => setConnection('offline', 'Kapcsolat nélkül')); });
    window.addEventListener('offline', () => { if (state.user) setConnection('offline', 'Kapcsolat nélkül'); });
    window.addEventListener('focus', () => { if (state.user && navigator.onLine) refreshCloud().catch(() => setConnection('offline', 'Kapcsolat nélkül')); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && state.user && navigator.onLine) refreshCloud().catch(() => setConnection('offline', 'Kapcsolat nélkül')); });
    window.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); $('#searchInput').focus(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); openBook(); }
    });
    window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); state.installPrompt = event; $('#installButton').hidden = false; });
    $('#installButton').addEventListener('click', async () => {
      if (!state.installPrompt) return;
      state.installPrompt.prompt();
      await state.installPrompt.userChoice;
      state.installPrompt = null;
      $('#installButton').hidden = true;
    });
    window.addEventListener('appinstalled', () => { $('#installButton').hidden = true; toast('A Polc telepítve.'); });
  }

  async function boot() {
    state.books = readLocal();
    state.lists = readLocalLists();
    state.config = readConfig();
    setupEvents();
    render();
    updateSettingsView();
    if (state.config?.url && state.config?.key) {
      try {
        const client = await getClient();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session?.user) {
          state.user = data.session.user;
          state.mode = 'cloud';
          state.books = readCloudCache(state.user.id);
          state.lists = readCloudListsCache(state.user.id) || state.lists;
          setConnection('cloud', 'Online könyvtár');
          updateSettingsView(); render();
          await refreshCloud();
        }
      } catch (error) {
        console.warn('A közös könyvtár nem érhető el.', error);
        if (state.user) state.books = readCloudCache(state.user.id);
        setConnection('offline', 'Szinkronizálási hiba');
        render();
      }
    }
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  boot();
})();

