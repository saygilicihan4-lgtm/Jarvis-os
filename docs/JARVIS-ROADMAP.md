# JARVIS geliştirme listesi

Güncelleme: 4 Ekim 2026. Bu belge kullanıcının internet asistanı, cihaz taşıma,
ücretsiz çalışma ve görsel kimlik hedeflerini takip eder. Kodun bulunması gerçek
Windows/iPhone testi yerine geçmez. Henüz bütün sitelerde çalışan, kesintisiz veya
sınırsız bir asistan iddiası yoktur.

## Öncelik ve kabul ölçütleri

| Sıra | Eklenecek / tamamlanacak özellik | Mevcut durum | Bitti sayılma koşulu |
| --- | --- | --- | --- |
| 1 | İçeriğe bağlı, süreli ve iptal edilebilir onay | v158 / #210: yerel görev verisi SHA-256 ile bağlanır, onay 15 dakika geçerlidir; disk üzerinde iptal ve tek kullanıcı turunda tek onay denemesi | Exact-head dört CI, merge ilişkisi ve main CI; gerçek cihaz denemesi ayrıca |
| 2 | Güvenli cihaz tanıma ve aynı ağdan giriş | v159 / #212: aynı ağ üzerinden kimliksiz oturum üretimi kaldırılır; telefon ve masaüstü mevcut doğrulanmış oturumu ağdan bağımsız kullanır | Aynı IP'deki tanınmayan tarayıcı oturum alamaz; mevcut güvenilir oturum ve tek kullanımlık kod regresyonu geçer; passkey/iPhone gerçek cihaz testi ayrıca |
| 3 | Telefonda ayrıntılı onay kartı | Mission Console ve bildirim temeli var; tam işlem inceleme kartı eksik | Site, hesap, işlem, değişecek alanlar, gönderilecek veri ve süre gösterilir; onay/reddet/iptal; istek kimliği ve cihazla bağlanır |
| 4 | Canlı işlem hedefi doğrulama | v158 yerel görev kaydını bağlar; canlı DOM/hesap/video/ürün içeriğini kanıtlamaz | Görev sekmesi kilitli; yönlendirme, form hedefi, hesap ve nesne kimliği değişirse işlem durur; yanlış video/form asla gönderilmez |
| 5 | İnternet araştırması ve kaynaklı rapor | Windows Browser Operator ve sayfa okuma var; varsayılan izinli alanlar YouTube/Shopify ağırlıklı | Kullanıcının verdiği HTTPS siteden sınırlı derinlikte okuma; kaynak URL/tarih; kısa özet, ayrıntılı rapor veya maddeler; erişilemeyen sayfa açıkça belirtilir |
| 6 | Kullanıcı adına kayıt ve form hazırlama | Kalıcı form doldurma + ayrı son tıklama var; genel site kayıt akışı tamamlanmış değil | Form önizlemesi, gizli alanların kalıcı kayda girmemesi, gereken yerde kullanıcıya CAPTCHA/2FA devri; ayrı son gönderim onayı ve sonuç kanıtı |
| 7 | Yeni bilgisayara taşıma sihirbazı | Eşleştirme kodu, imzalı cihaz kimliği ve bulut durum yedeği var; taşınabilir paket yok | Proje/hafıza/ayar seçimi, şifreli paket, hash kontrolü, yeni cihaz kimliği; sır/oturum/onay kopyalanmaz; görevler duraklatılarak alınır; eski cihaz iptal edilebilir |
| 8 | Ücretsiz yerel + bulut çalışma yönetimi | Yerel Worker/Ollama, web paneli, bildirim/relay ve kalıcı görevler var | Açık bilgisayar ağır işleri üstlenir; kapalıysa kuyruk bekler; ücretsiz kota/uyku durumları görünür; ücretli yola otomatik geçilmez |
| 9 | Kaynaklı öğrenme hafızası | Yerel hafıza ve dil/konuşma uyarlaması var; genel internetten kontrollü öğrenme eksik | Bilgi kaynağı ve tarihi tutulur; güvenilmeyen sayfa talimatı komut olmaz; çelişki/eski bilgi işaretlenir; kullanıcı inceleyebilir, silebilir ve geri alabilir |
| 10 | Altın hologram görünümü / isteğe bağlı yüz | Mevcut merkez arayüz CSS halkaları kullanıyor; verilen görseller tasarım referansı | Özgün parçacık/ışık ağı, dinleme-düşünme-konuşma durumlarıyla bağlantı, mobil düşük güç modu ve azaltılmış hareket; isteğe bağlı izinli/sentetik yüz ayrı modül |
| 11 | Proje geliştirici ve kontrollü kendini düzeltme | Developer Mission, dosya üretimi, hash kontrollü patch ve rollback var | İzole değişiklik, çalıştırma/test sonucu, regresyon değerlendirmesi, geri alma; internetten indirilen kod test edilmeden ana çalışma ortamına kurulmaz |
| 12 | Kurulum sitesi ve görünür doğrulama paneli | Kurulum betikleri ve tanılama raporları var; kullanıcıya adım adım dağıtım sitesi eksik | Donanıma göre indirmeler, tek çalışma klasörü, neden bekliyor açıklaması, yetenek bazında CI/yerel/gerçek cihaz kanıtlarının ayrı gösterimi |

Güvenlik ve güvenilirlik düzeltmeleri küçük PR'lar halinde önce yapılır. Görsel
arayüz değişikliği, tarayıcı yetkisinin genişletilmesi ve taşıma paketi ayrı PR'larda
incelenir. Bu sıra, tüm listenin şu anda tamamlandığı anlamına gelmez.

### Oturum güvenliği takip notu

v160 / #215, #214'ün dar bir ön koşuludur: kurtarma kodu doğrudan yalnız imzalı ve
zaten onaylı PC isteğiyle üretilir. Kod, üreten cihazın kimlik bilgisi kaydına ve
süresine bağlanır; cihaz iptali bekleyen kodu temizler. Açılışta kullanılabilir kod
üretilmez. Kodun gerçek geçerlilik süresi PC'de gösterilir.

Bu, mevcut tarayıcı çerezlerini iptal etmez veya yeni bir yüksek güvenli oturum
sınıfı oluşturmaz. Cihaz eşleştirme/kimlik bilgisi üretimi, passkey kaydı, kalıcı
oturum envanteri/iptali ve kod denemelerine hız sınırı ayrıca denetlenmelidir.
Özellikle tarayıcı yetkisiyle cihaz kaydetme/kimlik bilgisi alma yolları kapanmadan
kod akışı bütünü için "bağımsız yeniden kimlik doğrulama" iddiası yapılmaz.
Üretim sırları değiştirilmedi; #214 bu çalışmalar ve kontrollü eski oturum geçişi
tamamlanana kadar açık kalır.

v161 / #217, `/api/worker/device-token` yolundaki doğrudan tarayıcı çereziyle
PC kimlik bilgisi üretimini kapatır. İmzalı cihaz yalnız kendi kimliğini yeniler;
başlık/gövde/aktör tam eşleşir. Eski Worker geçişi için açıkça yapılandırılmış
yönetici sırrı yolu korunur; çerez veya boş-token geliştirme modu yeterli değildir.
İstek gövdesinden sonra süre/yetki tekrar kontrol edilir. Başlangıç kurtarması
yalnız eksik cihaz kaydını oluşturur, mevcut onaysız/iptal edilmiş kaydı onaylamaz.
Bu, yeniden başlatmalar arasında kalıcı iptal kanıtı değildir: snapshot geri
yükleme, eşleştirme ve passkey kaydı ayrıca incelenmelidir. #214 açık kalır.

## İnternet görevlerinin davranışı

- "Bu siteyi incele": izin verilen kapsamı okur, kaynakları korur, birbiriyle çelişen
  bilgiyi işaretler; kullanıcı isterse kısa özet, ayrıntılı rapor veya tablo üretir.
- "Benim adıma kayıt ol": alanları hazırlar, son gönderilecek veriyi gösterir;
  parola/OTP/CAPTCHA gereken noktada kullanıcı devreye girer. Site kuralları ve
  teknik erişim sınırları atlatılmaz.
- "Bu projeyi geliştir": çalışma alanında dosyaları değiştirir; test kanıtı ve
  geri alma kaydı üretir. Kontrolsüz kendini yeniden yazma yetkisi vermez.
- "Öğrenmeye devam et": kaynaklı bilgi toplama ve aday iyileştirme üretimidir.
  Bir web sayfasının söylediği komutu yürütmek ya da modelin ağırlıklarını otomatik
  eğitmekle aynı şey değildir. İş, çalışan bir Worker veya uygun sunucu gerektirir.

## Yeni bilgisayara geçiş tasarımı

1. Eski cihazdaki devam eden işleri güvenli noktada duraklat; tamamlanıp
   tamamlanmadığı belirsiz işlemleri yeniden çalıştırma.
2. Projeleri, gerekli dosyaları, seçili hafıza ve ayarları dışa aktar. Tarayıcı
   çerezleri, cihaz anahtarları, DPAPI sırları ve kullanılabilir işlem onaylarını
   taşıma. Varsayılan olarak üçüncü taraf hesaplarda yeniden giriş gerekir.
3. Yeni bilgisayara desteklenen çalışma ortamını kur; telefondaki güvenilir oturum
   üzerinden yeni tek kullanımlık eşleştirme kodu üret ve yeni cihazı eşleştir.
4. Paketi bütünlük kontrolünden sonra içe aktar; eski mutlak dosya yollarını güvenli
   çalışma alanına taşı. Taşınan görevleri önce duraklatılmış durumda göster.
5. Mikrofon, ses, F8, açılış, çevrimdışı kuyruk ve bağlantı testlerini yap. Sonuç
   belirsiz veya geri döndürülemez adımları ayrı incele ve yeniden onayla.
6. Kullanıcı yeni cihazı doğruladıktan sonra eski cihaz yetkisini kaldırabilir.

Bu bir uygulama tasarımıdır; henüz çalışır bir dışa/içe aktarma sihirbazı değildir.
IP veya Wi-Fi değişmesi cihaz kimliğinin yerine geçmez. Aynı ağ, tek başına güvenilir
telefon kanıtı değildir.

## 0 TL çalışma sınırı

Ağır AI, ses ve video üretimi mevcut bilgisayarda çalıştırılır. Bulut hafif kontrol,
kuyruk ve bildirim katmanıdır. Bilgisayar kapalıyken yerel işler bekler. Mevcut
internet/elektrik/donanım tüketimi sıfırlanmaz; ücretli API veya abonelik eklenmez.

4 Ekim 2026'da kontrol edilen resmî kaynaklar:

- [Render Free](https://render.com/docs/free): ücretsiz web servisleri hareketsizlikte
  uyur; ücretsiz kaynak/kullanım sınırları vardır. Süresiz ücretsiz 7/24 hesaplama
  taahhüdü olarak kullanılamaz.
- [MDN: Offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation):
  tarayıcı arka plan çalışanlarını durdurabilir. Bir tarayıcı sekmesi sürekli açık
  bir sunucunun yerine geçmez.

## Gerçek cihaz kabulü (sona bırakılan ayrı kapı)

Windows açılış/güncelleme, mikrofon ve konuşma, iPhone Safari/PWA oturum ve bildirim,
yeni bilgisayara geçiş, bağlantı kesilip gelmesi ve onay iptali gerçek cihazlarda
ayrıca denenmelidir. YouTube PUBLIC, Shopify PUBLIC ve gerçek kayıt/gönderim bu
geliştirme testlerinin parçası değildir; kullanıcı bunlar için ayrıca açık onay verir.
