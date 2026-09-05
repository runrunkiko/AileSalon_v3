// ============================================================
// microCMS 連携
//
// 役割:
//   ページ表示時に microCMS から内容を取得し、以下のセクションを差し替える。
//   API名はサイトのセクション名に合わせている。
//     - トップ写真        (API: top)
//     - ABOUT             (API: about)
//     - COURSE            (API: course)
//     - PHOTO             (API: photo)
//   取得できなかった場合は HTML に書いてある現在の内容がそのまま表示される。
//
// 設定:
//   下の CMS_CONFIG に microCMS の「サービスID」と「APIキー（GET のみ）」を入れる。
//   両方空のままなら何もしない（= 今までどおりの静的表示）。
//
// 安全のための方針:
//   - 文章は textContent で差し込む（HTMLとしては解釈しない）
//   - 画像URLは microCMS の画像ドメインのものだけ受け付ける
// ============================================================
(function () {
  var CMS_CONFIG = {
    serviceId: '',   // 例: 'aile-salon'  → https://aile-salon.microcms.io
    apiKey: ''       // 読み取り専用(GET)のAPIキー
  };

  // 動作確認用: URL に ?cms=mock を付けると cms-mock/*.json を読む
  var MOCK = /[?&]cms=mock(&|$)/.test(location.search);

  var IMAGE_HOST = 'https://images.microcms-assets.io/';

  // ---------- ユーティリティ ----------

  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) { e.className = className; }
    return e;
  }

  // 改行を <br> にしつつ、文字は文字として追加する
  function appendMultiline(parent, text) {
    var lines = String(text || '').split(/\r?\n/);
    lines.forEach(function (line, i) {
      if (i > 0) { parent.appendChild(el('br')); }
      parent.appendChild(document.createTextNode(line));
    });
  }

  // 画像URLの検証。microCMS の画像だけ許可し、サイズ指定を付けて軽くする
  function imageUrl(image, width) {
    if (!image || typeof image.url !== 'string') { return null; }
    var url = image.url;
    if (MOCK && /^img\//.test(url)) { return url; } // ローカル確認用
    if (url.indexOf(IMAGE_HOST) !== 0) { return null; }
    return url + '?w=' + width + '&q=75&fm=webp';
  }

  // slick が初期化済みなら解除する。
  // 解除せずに中身を消すと、slick が保持している元のスライドが復元されて二重になる。
  function unslick(wrap) {
    if (window.jQuery && jQuery(wrap).hasClass('slick-initialized')) {
      jQuery(wrap).slick('unslick');
    }
  }

  function byOrder(a, b) {
    var oa = typeof a.order === 'number' ? a.order : 9999;
    var ob = typeof b.order === 'number' ? b.order : 9999;
    return oa - ob;
  }

  function fetchList(api) {
    var url, opts = {};
    if (MOCK) {
      url = 'cms-mock/' + api + '.json';
    } else {
      url = 'https://' + CMS_CONFIG.serviceId + '.microcms.io/api/v1/' + api + '?limit=100';
      opts.headers = { 'X-MICROCMS-API-KEY': CMS_CONFIG.apiKey };
    }
    return fetch(url, opts).then(function (res) {
      if (!res.ok) { throw new Error(api + ': HTTP ' + res.status); }
      return res.json();
    }).then(function (json) {
      var list = Array.isArray(json.contents) ? json.contents.slice() : [];
      return list.sort(byOrder);
    });
  }

  // ---------- 各セクションの描画 ----------

  // トップ写真
  function renderHero(items) {
    var wrap = document.getElementById('slideContents');
    if (!wrap) { return; }
    var slides = [];
    items.forEach(function (item) {
      var url = imageUrl(item.image, 1200);
      if (!url) { return; }
      var slide = el('div', 'slide');
      slide.style.backgroundImage = 'url("' + url + '")';
      slide.style.backgroundSize = 'cover';
      slide.style.backgroundPosition = 'center center';
      slides.push(slide);
    });
    if (!slides.length) { return; }
    unslick(wrap);
    wrap.innerHTML = '';
    slides.forEach(function (s) { wrap.appendChild(s); });
    if (window.AILE && AILE.initHeroSlider) { AILE.initHeroSlider(); }
  }

  // ABOUT
  function renderAbout(items) {
    var list = document.querySelector('.aboutList');
    if (!list) { return; }
    var boxes = [];
    items.forEach(function (item) {
      var url = imageUrl(item.image, 1200);
      if (!url || !item.title) { return; }

      var box = el('div', 'box');

      var thumb = el('div', 'about-thumbnail');
      var img = el('img');
      img.src = url;
      img.alt = String(item.title).replace(/\r?\n/g, ' ');
      img.loading = 'lazy';
      thumb.appendChild(img);

      var article = el('div', 'about-article');
      var h2 = el('h2');
      var border = el('span', 'border');
      appendMultiline(border, item.title);
      h2.appendChild(border);
      var p = el('p');
      appendMultiline(p, item.body);
      article.appendChild(h2);
      article.appendChild(p);

      box.appendChild(thumb);
      box.appendChild(article);
      boxes.push(box);
    });
    if (!boxes.length) { return; }
    list.innerHTML = '';
    boxes.forEach(function (b) { list.appendChild(b); });
  }

  // コース
  function renderCourses(items) {
    var list = document.querySelector('.course-list');
    if (!list) { return; }
    var boxes = [];
    items.forEach(function (item) {
      if (!item.name) { return; }
      var box = el('div', 'course-box');
      var h3 = el('h3');
      h3.textContent = item.name;
      box.appendChild(h3);

      var p = el('p');
      appendMultiline(p, item.description);
      box.appendChild(p);

      String(item.price || '').split(/\r?\n/).forEach(function (line) {
        if (!line.trim()) { return; }
        var price = el('p', 'price');
        price.textContent = line;
        box.appendChild(price);
      });
      boxes.push(box);
    });
    if (!boxes.length) { return; }
    list.innerHTML = '';
    boxes.forEach(function (b) { list.appendChild(b); });
    // HTMLに固定で書いてある5つ目のボックス（リストの外）は不要になる
    var extra = document.querySelector('.course-area > .course-box');
    if (extra) { extra.parentNode.removeChild(extra); }
  }

  // フォトギャラリー
  function renderPhotos(items) {
    var wrap = document.getElementById('photoContents');
    if (!wrap) { return; }
    var photos = [];
    items.forEach(function (item) {
      var url = imageUrl(item.image, 1400);
      if (!url) { return; }
      var photo = el('div', 'photo');
      photo.style.backgroundImage = 'url("' + url + '")';
      photo.style.backgroundSize = 'cover';
      photo.style.backgroundPosition = 'center center';
      photos.push(photo);
    });
    if (!photos.length) { return; }
    unslick(wrap);
    wrap.innerHTML = '';
    photos.forEach(function (p) { wrap.appendChild(p); });
    if (window.AILE && AILE.initPhotoSlider) { AILE.initPhotoSlider(); }
  }

  // ---------- 実行 ----------

  var enabled = MOCK || (CMS_CONFIG.serviceId && CMS_CONFIG.apiKey);

  // main.js のローディング画面がこの Promise の完了を待つ
  window.AILE_CMS_READY = new Promise(function (resolve) {
    if (!enabled) { resolve(); return; }

    var whenDom = new Promise(function (r) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', r);
      } else { r(); }
    });

    var sections = [
      { api: 'top',    render: renderHero },
      { api: 'about',  render: renderAbout },
      { api: 'course', render: renderCourses },
      { api: 'photo',  render: renderPhotos }
    ];

    Promise.all(sections.map(function (s) {
      // 1つ失敗しても他は反映する（失敗した箇所はHTMLの内容のまま）
      return fetchList(s.api).catch(function (err) {
        console.warn('[cms] ' + err.message);
        return null;
      });
    })).then(function (results) {
      return whenDom.then(function () {
        results.forEach(function (items, i) {
          if (items) {
            try { sections[i].render(items); }
            catch (e) { console.warn('[cms] render ' + sections[i].api, e); }
          }
        });
      });
    }).then(resolve, resolve);
  });
})();
