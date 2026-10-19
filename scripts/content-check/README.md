# İçerik denetimi

Değerlendirme, alias'ların cevapta düz `includes` ile aranmasına dayanıyor (`src/domain/evaluate.ts`, `normalizeTr` sonrası). Gevşek bir alias konuyu bilmeyen birine başka bir sorunun cevabıyla kavram kazandırır; sıkı bir alias doğru cevabı kaçırır. Bu betik bütün içeriği bu açıdan ölçer.

## Çalıştırma

```sh
npm run check:content                                   # bütün içerik
npm run check:content -- --category sql -v              # sql ayrıntısı, eşleşen alias'larla
npm run check:content -- --edits taslak.json --base HEAD # depoya yazmadan önce fark
npm run check:content -- --base main                    # PR öncesi
```

| Seçenek | Ne yapar |
|---|---|
| `--category a,b` | Ayrıntıyı bu kategorilerle sınırlar. Ölçüm yine bütün içerikte yapılır: bir sql cevabı web'deki bir sorunun alias'ını tutabilir. |
| `--edits a.json,b.json` | merge-questions biçimindeki dosyalardaki soruları depodaki aynı id'lerin yerine koyar; diske yazmaz. |
| `--base <rev>` | Ölçümleri bir git revizyonuyla satır satır karşılaştırır. |
| `--prefix` | Alt dize taramasında önek eşleşmelerini de listeler. |
| `-v` | Çiftlerde her kavramı hangi alias'ın tuttuğunu, doğal cevapta kaçan kavramları gösterir. |

Çıktıda önce ayrıntı bölümleri, en sonda kategori başına özet tablo gelir. Betik rapor üretir, kapı değildir: uyarı olsa da çıkış kodu 0. Dosya okunamazsa 1, seçenek yanlışsa 2 döner.

**Sayıyı değil satırı karşılaştır.** Bir çift kalkıp yerine başka biri gelince kategorinin çift sayısı aynı kalır. `--base` bu yüzden çiftleri, uyarıları ve tuzakları tek tek karşılaştırır.

Önerilen akış:

1. Değişikliği merge-questions biçiminde bir dosyaya yaz.
2. `--edits <dosya> --base HEAD` ile farkı gör. Yeni çift, uyarı ya da tuzak çıkarsa çoğu zaman yeni cevaptaki bir kelimeyi değiştirmek yeter; başka sorunun alias'ına dokunma.
3. `npm run merge-questions -- <dosya> --replace`
4. PR'dan önce `--base main`.

## Kontroller

### Uyarılar: kavram ve alias (`rules.ts`)

- Model cevap kendi kavramlarının hepsini tutmalı.
- Soru başına 3–5 kavram, kavram başına 2–6 alias.
- 3 harf ve altı alias olmaz ("id", "video"nun içinde geçer). Harf içermeyenler ("::") serbest.
- Soruda geçen terim alias olmaz.
- Genel kelime alias olmaz (aşağıdaki listeler).
- Alias'ta `@` ve büyük harf olmaz. Noktalama silinmediği için `@Transactional`, `@` yazmayan cevabı kaçırır.
- Tek kelimelik alias 5 ya da daha fazla başka model cevapta geçiyorsa ifadeye çevrilir ("sık tek kelime").

### Biçim (`format.ts`)

- Tek paragraf, 2–5 cümle. Satır içi kod tek kelime sayılır. Kod dışında "ör. 500" ve "..." cümle böler.
- Not kutusu yok: paragrafın ilk `:` işareti ilk 48 karakterdeyse paragraf not kutusu olarak çizilir (`modelAnswer.ts`).
- Kod bloğu ve madde listesi yok.
- Kalın içinde kod ve tek yıldızlı italik yok, ikisi de çizilmiyor.
- followUp var; source `Kendi derleme — <birincil belge: bölüm>` ile başlıyor.

### Yarı isabet çiftleri (`pairs.ts`)

`hedef ← diğer` şu demek: diğer sorunun model cevabı, hedefin kavramlarının en az yarısını (`ceil(n/2)`) tutuyor. Çiftler üç sınıfa ayrılır:

- **kardeş:** aynı kategori, aynı topic;
- **aynı-kat:** aynı kategori, farklı topic;
- **başka-kat:** farklı kategori.

Kardeş ve ikiz sorularda çift kaçınılmaz olabilir. Kalan her çift için tek satırlık bir gerekçe yazılır; `-v` eşleşen alias'ları gösterir.

### Alt dize tuzakları (`substrings.ts`)

Alias başka bir cevapta bir kelimenin ortasında eşleşebilir: "slim" "teslim"de, "reload" "preload"da. Böyle bir eşleşme kavramı bedavaya kazandırır. Noktalamayla başlayan bir alias ("-slim") tuzak sayılmaz.

`--prefix` kelime başından eşleşip uzayanları da listeler ("window" → "windows"). Bunların çoğu Türkçe ek, elle bakılır.

### Doğal cevap denemesi (`probes.ts`, `probes/`)

Her soru için model cevaba bakmadan yazılmış kısa, gündelik bir mülakat cevabı. Model cevabın kendi kavramlarını tutması yetmez, alias'lar böyle bir cevabı da tutmalı. Özet tabloda tutulan / toplam kavram sayısı görünür; `-v` kaçan kavramları listeler.

Yeni soru eklerken `probes/<kategori>.json` dosyasına `"soru-id": "cevap"` satırı ekle. Cevabı model cevaba ve alias'lara bakmadan, mülakatta söyleyeceğin gibi yaz. Sonra alias'ları cevaba göre düzelt; cevabı alias'lara göre düzeltme. Setteki bir id içerikte yoksa rapor bunu ayrıca listeler. javascript'in seti yok.

## Genel kelime listeleri (`generic.ts`)

Bir kelimenin listede olması, onu tek başına alias olmaktan çıkarır; ifade içinde serbest kalır. Örneğin "tablo" alias olamaz, "tabloyu kilitler" olabilir. Karşılaştırma `normalizeTr` sonrası yapılır.

Tek kaynak `generic.ts`. Listeyi değiştirirsen bu bölümü de güncelle.

**Ortak liste (her kategori):** veri, data, nesne, obje, metot, metod, method, sınıf, class, hata, error, performans, kod, değer, value, işlem, fonksiyon, function, referans, dizi, liste, bellek, memory, ram, hız, hızlı, kullanılır, kullanıcı, user, uygulama, application, sistem, kontrol, otomatik, güvenli, güvenlik, sunucu, server, istemci, client, istek, request, yanıt, response, tarayıcı, browser, http, dosya, file, url, varsayılan, default, açık, kapalı, önce, sonra, ekle, sil, kendi, sıra, bağla, bekle, tercih, doğrudan, örnek, örneği, durum, sonuç, girdi, input, çıktı, output, yetki, parametre, izin, tek bir, birden fazla, değişti, değişken, sabit, test, id, sorun.

**Kategoriye özgü listeler.** Kategorinin hemen her cevabında geçen terimler, yalnızca o kategorinin sorularında yasak:

| Kategori | Ek kelimeler |
|---|---|
| docker | docker, container, konteyner, image, imaj, dockerfile, katman, layer, host |
| react | react, component, bileşen, state, props, prop, render, jsx, hook, dom |
| sql | sql, tablo, table, sorgu, query, satır, row, kolon, column, veritabanı, database, select, from, where, postgresql, postgres |
| dotnet | .net, dotnet, c#, csharp, sql |
| java | java, spring |
| web | başlık, header, bağlantı, connection, adres, durum kodu, status, java |
| cybersecurity | web listesi + security, secure, saldırı, attack, saldırgan, attacker, şifre, parola, password, zafiyet, vulnerability, risk, koruma, korur, önlem, token, cookie, çerez, erişim, access, kimlik, anahtar, key, doğrulama, validation, sorgu, query, script, javascript, html, tehlikeli, zararlı, kötü niyetli, malicious |
| javascript | yok, yalnızca ortak liste |

## Dosyalar

- **Giriş:** `scripts/content-check.ts`.
- **Kontroller:** `rules.ts`, `format.ts`, `pairs.ts`, `substrings.ts`, `probes.ts`.
- **Okuma:** `pool.ts` içeriği dizinden, git revizyonundan ya da `--edits` dosyalarından okur.
- **Çıktı:** `analyze.ts` ölçümleri toplar. `lines.ts` ve `report.ts` çıktıyı yazar, `compare.ts` karşılaştırmayı yapar.
- **Testler:** `checks.test.ts`, `npm test` ile birlikte çalışır.
- **Tip denetimi:** `tsconfig.content-check.json`. `src/domain`'deki import'lar uzantısız olduğu için uygulamanın `bundler` çözümlemesi kullanılır; diğer betiklerin `nodenext` ayarı bunları reddediyor.
