(() => {
  'use strict';

  const LOCAL_KEY = 'polc.books.v1';
  const CONFIG_KEY = 'polc.supabase.config.v1';
  const LABELS = { book: 'Könyv', ebook: 'E-könyv', audio: 'Hangoskönyv' };
  const STATUS_LABELS = ['Olvasatlan', 'Olvasom', 'Elolvastam', 'Félbehagytam'];
  const state = { books: [], status: 'all', format: 'all', query: '', mode: 'local', user: null, client: null, config: null, installPrompt: null, toastTimer: null };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

  function readLocal() {
    try { const value = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify(state.books)); }
  function cacheKey(userId) { return `polc.cloud.cache.${userId}`; }
  function readCloudCache(userId) {
    try { const value = JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function saveCloudCache() { if (state.user) localStorage.setItem(cacheKey(state.user.id), JSON.stringify(state.books)); }
  function readConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); }
    catch { return null; }
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

  function updateSettingsView() {
    $('#accountPanel').hidden = Boolean(state.user);
    $('#signedInPanel').hidden = !state.user;
    $('#signedInEmail').textContent = state.user?.email || '';
    $('#syncExplanation').innerHTML = state.user
      ? `A könyvtárad <strong>közös online adatbázisból</strong> töltődik be. Jelentkezz be ugyanezzel a fiókkal a többi eszközödön is.`
      : `Most a könyveid ezen az eszközön vannak. A közös online könyvtárhoz add meg a projekt adatait, majd jelentkezz be — a többi eszközön ugyanazt a fiókot használd.`;
    if (state.config) {
      $('#projectUrl').value = state.config.url || '';
      $('#publicKey').value = state.config.key || '';
    }
  }

  function visibleBooks() {
    const query = state.query.trim().toLocaleLowerCase('hu');
    return state.books.filter(book => {
      const statusMatch = state.status === 'all' || book.status === state.status;
      const formatMatch = state.format === 'all' || book.format === state.format;
      const text = [book.title, book.author, book.isbn, book.category, book.notes].join(' ').toLocaleLowerCase('hu');
      return statusMatch && formatMatch && (!query || text.includes(query));
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
    return `<article class="book-card" data-book-id="${esc(book.id)}">
      <div class="book-cover cover-${coverColor(book)}" aria-hidden="true"><span class="cover-initial">${esc(short)}</span><span class="cover-type">${esc(LABELS[book.format] || LABELS.book)}</span></div>
      <div class="book-info"><span class="book-type">${esc(LABELS[book.format] || LABELS.book)}</span><h3 class="book-title" title="${esc(book.title)}">${esc(book.title)}</h3><span class="book-author">${esc(book.author)}</span><div class="book-meta"><span class="status-pill ${statusClass}">${esc(book.status || 'Olvasatlan')}</span>${book.category ? `<span class="category-label">${esc(book.category)}</span>` : ''}</div></div>
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
      const active = button.dataset.status === state.status;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const books = visibleBooks();
    $('#booksGrid').innerHTML = books.length ? books.map(cardHTML).join('') : emptyHTML(state.books.length > 0);
  }

  function openBook(book = null) {
    $('#bookForm').reset();
    $('#bookId').value = book?.id || '';
    $('#bookTitle').value = book?.title || '';
    $('#bookAuthor').value = book?.author || '';
    $('#bookFormat').value = book?.format || 'book';
    $('#bookStatus').value = book?.status || 'Olvasatlan';
    $('#bookCategory').value = book?.category || '';
    $('#bookIsbn').value = book?.isbn || '';
    $('#bookNotes').value = book?.notes || '';
    $('#bookDialogTitle').textContent = book ? 'Könyv szerkesztése' : 'Új könyv';
    $('#bookDialog').showModal();
    setTimeout(() => $('#bookTitle').focus(), 0);
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
          setConnection('local', 'Helyi tárhely');
          render();
        }
        updateSettingsView();
      });
    }
    return state.client;
  }

  function rowToBook(row) {
    return { id: row.id, title: row.title, author: row.author, format: row.format, status: row.status, category: row.category || '', isbn: row.isbn || '', notes: row.notes || '', addedAt: row.created_at, updatedAt: row.updated_at };
  }
  function bookToRow(book) {
    const now = new Date().toISOString();
    return { id: book.id, user_id: state.user.id, title: book.title, author: book.author, format: book.format, status: book.status, category: book.category || null, isbn: book.isbn || null, notes: book.notes || null, created_at: book.addedAt || now, updated_at: now };
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
    state.books = (data || []).map(rowToBook);
    state.mode = 'cloud';
    saveCloudCache();
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
      toast(error?.message?.includes('books') ? 'Nem érhető el az adatbázis. Futtasd a beállítási SQL-t.' : 'Nem sikerült menteni. Ellenőrizd az internetkapcsolatot és a beállításokat.');
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
      if (state.books.length === 0 && localBooks.length > 0 && confirm(`A közös könyvtár még üres. Feltöltöd a mostani ${localBooks.length} helyi könyvedet is?`)) {
        try {
          const cloudBooks = localBooks.map(book => ({ ...book, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}` }));
          const { error: uploadError } = await client.from('books').insert(cloudBooks.map(bookToRow));
          if (uploadError) throw uploadError;
          await refreshCloud();
        } catch (uploadError) {
          console.error(uploadError);
          toast('Bejelentkeztél, de a helyi könyvek feltöltése nem sikerült. A helyi lista megmaradt.');
        }
      }
      $('#settingsDialog').close();
      toast(mode === 'signup' ? 'Fiók létrehozva, könyvtár szinkronizálva.' : 'Bejelentkezve, könyvtár szinkronizálva.');
    } catch (error) {
      console.error(error);
      const message = /Invalid login credentials/i.test(error?.message || '') ? 'Hibás e-mail-cím vagy jelszó.' : /fetch|network/i.test(error?.message || '') ? 'Nem érhető el a szolgáltatás. Ellenőrizd a projekt URL-t és az internetet.' : error?.message || 'Nem sikerült bejelentkezni.';
      toast(message);
    }
  }

  function exportLibrary() {
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), books: state.books }, null, 2);
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
    $('#searchInput').addEventListener('input', event => { state.query = event.target.value; render(); });
    $('#formatFilter').addEventListener('change', event => { state.format = event.target.value; render(); });
    $$('.filter-tab').forEach(button => button.addEventListener('click', () => { state.status = button.dataset.status; render(); }));
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

