# JARVIS Tab-Instance Final Target Binding v192

## Amaç

Final ve sonuç doğuran tarayıcı tıklamasını yalnız URL, hesap, kanal/mağaza, kaynak ID, form ve DOM yüzeyine değil **aynı gerçek CDP sekme/target örneğine** bağlamak.

Bu adım v191'de kalan TOCTOU riskini kapatır: iki sekmede aynı video/ürün ve aynı form görünse bile doğrulama bir sekmede yapıldıktan sonra tıklama başka sekmeye kayamaz.

## Akış

1. `verifiedFinalClick` tek bir CDP page target seçer ve target ID'yi pinler.
2. Snapshot bu sekmeden alınır; target ID `tabHash` olarak SHA-256 ile receipt binding'e girer.
3. Mevcut URL/account/target/resource/form/surface kontrolleri yapılır.
4. Tıklamadan hemen önce aynı target ID CDP listesinden yeniden çözülür. Sekme kapanmışsa işlem `FINAL_TARGET_TAB_CLOSED` ile durur.
5. Aynı sekmeden ikinci snapshot alınır ve receipt tekrar doğrulanır.
6. Tıklama yeniden `activePage()` seçmek yerine aynı pinned WebSocket target üzerinde çalıştırılır.

## Güvenlik özellikleri

- Aynı içerikli başka sekme `FINAL_TARGET_CHANGED` üretir.
- İsteğe bağlı `expectedTabHash` ilk doğrulamada yanlış sekmeyi `tab_mismatch` ile reddeder.
- Raw CDP target ID receipt'e yazılmaz; yalnız SHA-256 `tabHash` taşınır.
- YouTube/Shopify kaynak kimlikleri v191'deki gibi case-sensitive kalır.
- Yeni publish, approval, ödeme veya hesap yetkisi eklenmez.

## Güncelleme güveni

v192 tarayıcı katmanı önceki tam operatörü `jarvis-browser-operator-v191-base.js` altında sabitler, küçük v192 katmanı yalnız final-click pinning'i ekler. Trusted updater manifesti wrapper, base ve final-target verifier dosyalarını birlikte stage/validate eder; böylece bağımlılık yarım güncellenmez.

## Sınır

Bu CI tab-instance/TOCTOU davranışını ve statik sözleşmeleri doğrular. Gerçek Windows tarayıcı + gerçek YouTube Studio/Shopify Admin kabul testi, PUBLIC işlem yapmadan ayrıca fiziksel acceptance aşamasında kanıtlanmalıdır.
