# JARVIS Mobile Session Security v195

## Amaç

v163 ile sunucu/API tarafında tamamlanan yönetilen v3 tarayıcı oturum yaşam döngüsünü telefonda sahibi tarafından görülebilir ve yönetilebilir hale getirmek.

## Kullanıcı akışı

- Mobil JARVIS cockpit içindeki **Ayarlar** düğmesi güvenlik/oturum panelini açar.
- Panel `/api/sessions/status` ile mevcut oturum tipini, kalıcı depo durumunu, legacy-v2 politikasını ve IP/ağ değişimi risk göstergesini gösterir.
- Yönetilen v3 oturumda `/api/sessions` üzerinden oturum listesi alınır.
- Oturum kimlikleri kullanıcıya yalnız kısaltılmış hash olarak gösterilir; cookie, SID, passkey veya ham kimlik bilgisi gösterilmez ya da tarayıcı depolamasına yazılmaz.
- Tek bir oturum iptal edilebilir; mevcut telefonun oturumu için ayrıca açık onay gerekir.
- Mevcut telefon dışındaki aktif yönetilen oturumlar topluca iptal edilebilir.
- Legacy v2 oturumları yalnız yönetilen v3 oturumdan ve sunucunun açık `DISABLE_LEGACY_SESSIONS` onayıyla kalıcı olarak kapatılabilir.
- Legacy v2 ile giriş yapılmışsa panel otomatik iptal iddiasında bulunmaz; önce tek kullanımlık kod/passkey ile v3 recovery gerektiğini açıkça gösterir.

## Güvenlik sınırı

Bu sürüm yeni oturum yetkisi üretmez. Mevcut v163 API'lerini sahip arayüzüne bağlar. Panel `localStorage`, `sessionStorage`, `document.cookie`, passkey public-key materyali veya ham session cookie kullanmaz. YouTube/Shopify publish, ödeme, hesap veya görev onay yetkisi eklemez.

## Kanıt sınırı

CI; loader sırasını, endpoint sözleşmelerini, secret-persistence yasağını, revocation/migration kontratlarını ve authority sınırlarını doğrular. Gerçek iPhone/passkey görünüm ve fiziksel E2E testi ayrı acceptance gate olarak kalır.
