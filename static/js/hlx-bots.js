/* ─────────────────────────────────────────────────────────────────────────
   HYPRLVX Free-Bots loader bridge
   The app build normally reads Free Bot records and files directly from
   Appwrite. HYPRLVX serves public site bots from its own backend, so this
   bridge keeps the existing application flow but redirects the bot catalog
   and bot-file reads to the site's public runtime endpoints.

   No authentication state is used for public bot metadata. The backend
   endpoint only exposes active bots assigned to the currently published site.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var origFetch = window.fetch.bind(window);
  var FILE_VIEW_RE = /\/storage\/buckets\/[^/]+\/files\/([^/?]+)\/view/;
  var API_TIMEOUT_MS = 8000;

  function withTimeout(input, init) {
    init = init || {};
    if (init.signal || !window.AbortController) return origFetch(input, init);

    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, API_TIMEOUT_MS);
    var nextInit = Object.assign({}, init, { signal: controller.signal });
    return origFetch(input, nextInit).finally(function () { clearTimeout(timer); });
  }

  function looksLikeBotDocument(doc) {
    if (!doc || typeof doc !== 'object') return false;
    var keys = Object.keys(doc).map(function (key) { return key.toLowerCase(); });
    if (keys.some(function (key) {
      return key === 'storagefileid' || key === 'botid' || key === 'botname' ||
        key === 'botdescription' || key === 'botfile' || key === 'botfileid' ||
        key === 'premium' || key === 'xmlfile';
    })) return true;
    return (keys.indexOf('name') !== -1 || keys.indexOf('displayname') !== -1) &&
      (keys.indexOf('file') !== -1 || keys.indexOf('xmlfile') !== -1 ||
       keys.indexOf('category') !== -1 || keys.indexOf('version') !== -1);
  }

  function isAppwriteDocumentsRequest(url) {
    return /appwrite/i.test(url) &&
      /\/databases\/[^/]+\/collections\/[^/]+\/documents/i.test(url);
  }

  function toAppwriteDocument(bot) {
    /* The application's existing bot identity is the database bot.id.
       Do not replace it with the storage/file ID: the Load Bot flow uses the
       document ID to request the corresponding bot from our backend. */
    var botId = String(bot.id || '');
    var storageFileId = String(bot.storageFileId || bot.fileId || botId);
    var name = String(bot.name || bot.botName || bot.displayName || '');
    var description = String(bot.description || bot.botDescription || '');
    return {
      $id: botId,
      $createdAt: bot.createdAt || new Date().toISOString(),
      $updatedAt: bot.updatedAt || new Date().toISOString(),
      id: botId,
      botId: botId,
      name: name,
      botName: name,
      displayName: name,
      description: description,
      botDescription: description,
      category: bot.category,
      version: bot.version,
      premium: bot.premium === true,
      storageFileId: storageFileId,
      fileId: storageFileId,
      file: bot.file || '',
      data: bot
    };
  }

  function replaceBotCatalogResponse(response, originalPayload) {
    var docs = Array.isArray(originalPayload && originalPayload.documents) ? originalPayload.documents : null;
    if (!docs || !docs.some(looksLikeBotDocument)) return response;

    return withTimeout('/api/appwrite/bots', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
    }).then(function (publicResponse) {
      if (!publicResponse.ok) return response;
      return publicResponse.json().then(function (payload) {
        var publicBots = Array.isArray(payload && payload.bots) ? payload.bots : [];
        if (!publicBots.length) return response;

        var replacement = Object.assign({}, originalPayload, {
          documents: publicBots.map(toAppwriteDocument),
          total: publicBots.length
        });

        return new Response(JSON.stringify(replacement), {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers({ 'Content-Type': 'application/json' })
        });
      }).catch(function () { return response; });
    }).catch(function () { return response; });
  }

  window.fetch = function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';

      /* Free Bot file: Appwrite storage -> our public site bot endpoint. */
      if (/appwrite/i.test(url)) {
        var m = url.match(FILE_VIEW_RE);
        if (m && m[1]) {
          return withTimeout('/api/appwrite/bot-xml?id=' + encodeURIComponent(m[1]), init);
        }
      }

      /* Free Bot catalog: inspect the real Appwrite response and replace only
         a response that actually has bot-specific document fields. This avoids
         changing unrelated Appwrite collections while making the public site
         the source of truth for bot name/metadata/file IDs. */
      if (isAppwriteDocumentsRequest(url)) {
        return withTimeout(input, init).then(function (response) {
          if (!response.ok) return response;
          return response.clone().json().then(function (payload) {
            return replaceBotCatalogResponse(response, payload);
          }).catch(function () { return response; });
        });
      }

      /* Bound only our same-origin startup/data bridge. External Deriv,
         analytics and trading requests keep their original behaviour. */
      if (/^\/?api\/appwrite\//i.test(url) || /^https?:\/\/[^/]+\/api\/appwrite\//i.test(url)) {
        return withTimeout(input, init);
      }
    } catch (e) { /* fall through to the original request */ }
    return origFetch(input, init);
  };
})();
