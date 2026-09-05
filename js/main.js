//loading画面
$(window).on('load',function(){
  $("#loading").delay(4500).fadeOut('slow');//ローディング画面を4.5秒（1500ms）待機してからフェードアウト
  $("#dogLoading").delay(4500).fadeOut('slow');//ロゴを4.5秒（1200ms）待機してからフェードアウト
});

//トップ画像
$(function(){
    setTimeout(function(){
        $('#slideContents').slick({
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
    },4000);
});

//フォトギャラリー
$('#photoContents').slick({
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
// ページ内遷移
$(function(){
    $('#areaNav a[href*="#"]').click(function(){
        var headerHight = 150;
        var elmHash = $(this).attr('href');
        var pos = $(elmHash).offset().top-headerHight;
        $('body,html').animate({scrollTop: pos}, 800);
        return false;
        console.log('きたよ');
    });
});

// ページ内遷移_CTA1
$(function(){
    $('.CTA1 a[href*="#"]').click(function(){
        var headerHight = 150;
        var elmHash = $(this).attr('href');
        var pos = $(elmHash).offset().top-headerHight;
        $('body,html').animate({scrollTop: pos}, 800);
        return false;
        console.log('きたよ');
    });
});
//ページトップボタン
$(function(){
  $("h1").on("click", function(){
    $("html, body").animate({scrollTop: 0 }, 800, "swing");
  });
});
//フッターページトップボタン
$(function(){
  $("#page_top").on("click", function(){
    $("html, body").animate({scrollTop: 0 }, 600, "swing");
  });
});
//ハンバーガーメニュー
$(function () {
  $('#menuButton').on('click', function () {
    $('#menuButton').toggleClass('active');
    $('#nav').toggleClass('active');
  })
});
$(function () {
  $('#nav a').on('click', function () {
    $('#nav').toggleClass('active');
    $('#menuButton').toggleClass('active');
  })
});