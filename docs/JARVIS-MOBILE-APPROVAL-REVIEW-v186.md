# JARVIS Mobile Approval Review v186

## Amaç

Telefon kokpitinde `waiting_dependency / approval` durumundaki kalıcı görevler için ayrı bir inceleme kartı gösterir. Kart yeni bir onay yolu oluşturmaz; mevcut Mission Actions onay/iptal düğmelerini hedefi yeniden doğruladıktan sonra proxy eder.

## Kartta gösterilenler

- İşlem yüzeyi: Web, Shopify veya YouTube.
- Hedef: site alan adı, ürün taslağı veya video taslağı.
- Hesap hedefi: mevcut güvenli telemetride varsa store/channel hash; yoksa bağlı hesap türü.
- Değişecek alanlar / görünürlük değişikliği.
- Gönderilecek değişikliğin güvenli özeti. Form değerleri kartta yeniden açığa çıkarılmaz; yalnız alan adları gösterilir.
- Onayın azami geçerlilik süresi.
- İşi yürüten PC Worker adı ve çevrimiçi durumu.
- Mission ID kuyruğu ve 20 haneli REQ fingerprint bağı.

## Fail-closed davranış

ONAYLA veya REDDET / GÖREVİ İPTAL ET tıklamasında mobil katman doğrudan Worker komutu ya da approval API çağrısı üretmez. Önce aynı mission ID'ye sahip gizli/yerleşik görev kartını bulur; canlı kart etiketi ve REQ fingerprint'i güncel telemetriyle birebir eşleşmezse işlem yapılmaz. Tam bir eşleşme varsa yalnız mevcut `data-jarvis-mission-action` düğmesine programatik tıklama yapılır. Mevcut Mission Actions katmanı daha sonra fresh state, Worker receipt ve durable state proof kontrollerini yürütür.

## Sınır

Bu sürüm güvenli telemetride bulunmayan hassas form değerlerini telefona taşımayı özellikle yapmaz. Bu nedenle roadmap'teki "gönderilecek verinin bütün değerlerini ayrıntılı göster" maddesinin hassas veri politikasıyla uyumlu yapılandırılmış telemetri kısmı ayrıca ele alınmalıdır. v186 bunu tamamlandı diye işaretlemez.
