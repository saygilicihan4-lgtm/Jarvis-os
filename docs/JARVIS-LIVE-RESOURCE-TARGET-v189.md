# JARVIS Live Resource Target Binding v189

## Amaç

Final tıklama doğrulamasını yalnız mağaza/kanal seviyesine değil, açık olan gerçek iş nesnesine de bağlamak. Böylece onaylanan YouTube videosu veya Shopify ürünü yerine yanlış nesne açıkken ilk doğrulama aşamasında da fail-closed davranılabilir.

## Kaynak kanıtı

`jarvis-final-target-verification.js` v1.2 HTTPS URL yolundan güvenli kaynak kanıtı çıkarır:

- YouTube Studio: `/video/<id>/...` → `video`
- Shopify Admin: `/store/<store>/products/<id>` → `product`
- Shopify Admin için ayrıca orders, customers, collections ve discounts kaynak tipleri tanınır.

Kaynak kimliği receipt'e düz metin olarak yazılmaz. `kind:id` birleşiminden SHA-256 `resourceHash` üretilir ve final `bindingHash` içine katılır.

## Approval sözleşmesi

Sözleşme isteğe bağlı olarak `expectedResource`, `expectedResourceHash` ve `expectedResourceKind` taşıyabilir. Bunlardan biri verilmişse yanlış video/ürün ilk verify aşamasında `resource_mismatch` veya `resource_kind_mismatch` ile durur.

Sözleşmede açık kaynak beklentisi olmasa bile receipt canlı URL'den çıkarılan `resourceHash` ile oluşturulduğu için verify ile final-click arasındaki video/ürün değişimi `FINAL_TARGET_CHANGED` üretir.

## Güvenlik sınırı

Bu sürüm yeni publish veya approval yetkisi eklemez. Mevcut Browser Operator final-click zincirinin kanıtını güçlendirir. Kaynak ID'leri receipt'te açığa çıkarılmaz.

## Kalan iş

Gerçek tarayıcı tab-instance kimliğinin receipt'e bağlanması hâlâ ayrı bir adımdır. URL + hesap + mağaza/kanal + resource ID + form + DOM yüzeyi değişiklikleri artık fail-closed bağlıdır; aynı bağlama sahip başka bir sekme teorik olarak ayırt edilemez.
