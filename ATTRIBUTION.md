# Atıf ve kaynaklar

Bu dosya repodaki içeriğin nereden geldiğini ve hangi lisansla
kullanıldığını anlatır. Lisans metinlerinin kendisi ayrı dosyalarda:

| Ne | Lisans | Metin |
|---|---|---|
| Kaynak kod (repo'nun `src/content/` dışındaki her şeyi) | MIT | [`LICENSE`](LICENSE) |
| Soru içeriği (`src/content/`: sorular, örnek cevaplar, kavramlar) | CC BY-SA 4.0 | [`src/content/LICENSE`](src/content/LICENSE) |
| Dış kaynaktan türetilmiş içerik | Kaynağın lisansı (bugün yalnızca MIT) | [`src/content/THIRD_PARTY_NOTICES`](src/content/THIRD_PARTY_NOTICES) |

Uygulamada aynı üç metin alt bilgideki **Açık kaynak · Lisanslar**
panelinde, pakete gömülü olarak gösterilir (`src/content/licenses.ts`).

## Dış kaynaktan türetilmiş içerik

Her sorunun `origin` alanı kökenini taşır: `{ "kind": "own" }` ya da
`{ "kind": "external", "repo", "url", "license" }`.

| Kaynak | Lisans | Soru | Ne türetildi |
|---|---|---|---|
| [sudheerj/reactjs-interview-questions](https://github.com/sudheerj/reactjs-interview-questions) | MIT | 44 (react) | Soru metinleri çeviri. Cevaplar react.dev'e göre büyük ölçüde yeniden yazıldı. |

Geri kalan sorular kendi yazımımızdır (`origin.kind = "own"`).

MIT'in tek şartı telif ve izin metninin dağıtılan kopyalarda bulunması.
Bildirim `THIRD_PARTY_NOTICES`'ta ve uygulamanın Lisanslar panelinde.
MIT alt lisanslamaya izin verdiği için bu sorular CC BY-SA 4.0 içerikle
birlikte dağıtılabilir; MIT bildirimi kalkmaz.

## Başvurulan kaynaklar

Soruların `source` alanı, cevap yazılırken okunan birincil belgeleri
listeler ("Kendi derleme — <belge: bölüm>"). Bu belgelerden **metin
türetilmedi**: cevaplar kendi cümlelerimizle yazıldı. Bu yüzden bugün
aşağıdakilere yasal atıf borcu yok; liste, ileride birinden uyarlama
yapılırsa hangi kuralın geçerli olacağını gösterir.

| Kaynak | Lisans | Uyarlama yapılırsa |
|---|---|---|
| OWASP (Cheat Sheet Series, WSTG, Top 10, ASVS) | CC BY-SA 4.0 | Serbest; atıf ve aynı lisans. |
| MDN Web Docs | CC BY-SA 2.5 (kod örnekleri CC0) | Serbest; 2.5 §4(b) sonraki sürüme (4.0) izin veriyor. Atıf: "Mozilla Contributors". |
| react.dev, legacy.reactjs.org | CC BY 4.0 | Serbest; atıf. |
| Microsoft Learn | CC BY 4.0 (kod MIT) | Serbest; atıf. |
| WHATWG (HTML, Fetch, DOM) | CC BY 4.0 | Serbest; atıf. |
| Docker Docs, Spring belgeleri | Apache 2.0 | Serbest; lisans ve değişiklik bildirimi. |
| PostgreSQL belgeleri | PostgreSQL License | Serbest; telif bildirimi. |
| Node.js, webpack, Vite, TanStack belgeleri | MIT | Serbest; telif bildirimi. |
| NIST yayınları | ABD kamu malı | Serbest. |
| IETF RFC'leri | IETF Trust Legal Provisions | **Uyarlama yapılmaz**; alıntı ve başvuru serbest. |
| Oracle (Java SE, JLS, JVMS, MySQL kılavuzu) | Tüm hakları saklı / spesifikasyon lisansı | **Uyarlama yapılmaz.** |
| PortSwigger Web Security Academy | Tüm hakları saklı | **Uyarlama yapılmaz.** |
| W3C belgeleri | W3C Document License | **Uyarlama yapılmaz.** |
| GNU Bash Reference Manual | GFDL 1.3 | **Uyarlama yapılmaz**: GFDL CC BY-SA 4.0 ile uyumsuz. |
| Kitaplar ve makaleler (Effective Java, Fowler, R. C. Martin vb.) | Tüm hakları saklı | **Uyarlama yapılmaz**; fikirler serbest. |

Lisansı belirsiz ya da doğrulanmamış kaynaklar (Hibernate belgeleri,
ECMA-262, JEP'ler, OpenID, FIDO, lisans dosyası olmayan repolar) da
"uyarlama yapılmaz" sayılır. Tam döküm ve gerekçeler:
[`docs/content-audit.md`](docs/content-audit.md), bölüm 3.

## Katkı kuralları

- **Dış kaynaktan soru eklerken:**
  - `origin`'i `external` olarak doldur.
  - `source`'u `; soru kaynağı: <sahip/repo> (<lisans>)` ile bitir.
  - Repo'nun lisans metnini telif satırıyla `THIRD_PARTY_NOTICES`'a ekle.
  - Bu dosyadaki tabloyu güncelle.
- **Lisans kabul edilen listede değilse** (`EXTERNAL_LICENSES`,
  `src/domain/question.ts`: MIT, CC BY 4.0, CC BY-SA 4.0, Apache 2.0),
  önce CC BY-SA 4.0 ile uyumunu değerlendir; uyumluysa listeye ekle.
- **"Uyarlama yapılmaz" kaynaklardan** çeviri ya da yakın uyarlama
  yapma. Bilgi için oku, cevabı kendi cümlelerinle yaz, `source`'ta belgeyi
  an.
- **Gerçek mülakat soruları:** soru metnini olduğu gibi alma, şirket adı
  ya da bağlamı yazma; aynı kavramı kendi cümlenle sor.
- `npm run check:content` ve `src/content/origin.test.ts`, `origin` ile
  `source` arasındaki çelişkiyi ve bildirimi olmayan dış repo'yu reddeder.
