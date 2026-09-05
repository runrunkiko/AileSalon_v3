// ============================================================
// ローディング画面
// 画像などの読み込み完了（window load）と、CMSからの取得（cms.js）の
// 両方が終わったらフェードアウトする。
// 一瞬で消えると犬のアニメが見えないので、最低 MIN_SHOW ms は表示する。
// ============================================================
(function () {
  var MIN_SHOW = 1200;
  var CMS_WAIT_MAX = 3000; // CMSが遅くてもこれ以上は待たない
  var start = Date.now();
  var done = false;

  var hideLoading = function () {
    if (done) { return; }
    done = true;
    var wait = Math.max(0, MIN_SHOW - (Date.now() - start));
    setTimeout(function () {
      $('#loading').fadeOut('slow');
    }, wait);
  };

  // CMS取得の完了（cms.js が用意する。無ければ即解決）
  var cmsReady = window.AILE_CMS_READY || Promise.resolve();
  var cmsOrTimeout = Promise.race([
    cmsReady,
    new Promise(function (resolve) { setTimeout(resolve, CMS_WAIT_MAX); })
  ]);

  var onLoad = function () {
    cmsOrTimeout.then(hideLoading, hideLoading);
  };

  // キャッシュ済みだと load がこのスクリプトより先に終わっていることがあるので、
  // ready を待たずに即座に登録し、すでに完了していればそのまま進める。
  if (document.readyState === 'complete') {
    onLoad();
  } else {
    $(window).on('load', onLoad);
  }
  // 万一 load が発火しない場合の保険（8秒で強制的に閉じる）
  setTimeout(hideLoading, 8000);
})();

// ============================================================
// スライダー（slick）
// CMSでスライドを差し替えたあとに再初期化できるよう、関数にしておく
// ============================================================
window.AILE = window.AILE || {};

AILE.initHeroSlider = function () {
  var $el = $('#slideContents');
  if ($el.hasClass('slick-initialized')) { $el.slick('unslick'); }
  $el.slick({
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2300,
    waitForAnimate: false,
    pauseOnFocus: false,
    pauseOnHover: false,
    responsive: [
      {
        breakpoint: 1025,
        settings: {
          arrows: true,
          centerMode: true,
          centerPadding: '0',
          slidesToShow: 1
        }
      }
    ]
  });
};

AILE.initPhotoSlider = function () {
  var $el = $('#photoContents');
  if ($el.hasClass('slick-initialized')) { $el.slick('unslick'); }
  $el.slick({
    autoplay: true,
    centerMode: true,
    arrows: true,
    centerPadding: '150px',
    slidesToShow: 1,
    autoplaySpeed: 2000,
    waitForAnimate: false,
    pauseOnFocus: false,
    pauseOnHover: false,
    responsive: [
      {
        breakpoint: 1025,
        settings: {
          arrows: true,
          centerMode: true,
          centerPadding: '100px',
          slidesToShow: 1
        }
      },
      {
        breakpoint: 480,
        settings: {
          arrows: true,
          centerMode: true,
          centerPadding: '0',
          slidesToShow: 1
        }
      }
    ]
  });
};

$(function () {
  AILE.initHeroSlider();
  AILE.initPhotoSlider();
});

// ============================================================
// ページ内リンクのスムーススクロール
// ナビ・CTAボタン・ロゴ（href="#"）・ページトップボタンをまとめて処理する。
// ============================================================
$(function () {
  var headerOffset = function () {
    // PCは固定ヘッダーの高さ分ずらす。SPはハンバーガーだけなので少しだけ。
    return window.innerWidth > 1024 ? $('.nav-wrap').outerHeight() + 30 : 30;
  };

  $('a[href^="#"]').on('click', function (e) {
    var href = $(this).attr('href');
    var isTop = href === '#';
    var $target = isTop ? $('html') : $(href);
    if (!$target.length) {
      return; // 存在しないIDならブラウザ標準の挙動に任せる
    }
    e.preventDefault();
    var pos = isTop ? 0 : $target.offset().top - headerOffset();
    $('html, body').animate({ scrollTop: pos }, 800, 'swing');
  });
});

// ============================================================
// ハンバーガーメニュー（SP）
// ============================================================
$(function () {
  var $button = $('#menuButton');
  var $nav = $('#nav');

  $button.on('click', function () {
    $button.toggleClass('active');
    $nav.toggleClass('active');
  });

  // メニュー内のリンクを押したら閉じる
  $nav.find('a').on('click', function () {
    $button.removeClass('active');
    $nav.removeClass('active');
  });
});
