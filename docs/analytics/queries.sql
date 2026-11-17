-- Kullanım ölçümü analiz sorguları (analytics_event, V4 migration).
--
-- Her sorgu kendi başına çalışır; psql ya da herhangi bir istemcide tek tek
-- çalıştırılır. Tablo hesapla ilişkilendirilmeyen, rastgele kurulum kimliği
-- (install_id) taşır; buradaki "kullanıcı" her yerde "kurulum" demek: aynı
-- kişi iki cihazda iki kurulum sayılır, uygulamayı silip kuran yeni kurulumdur.
--
-- GÜN TANIMI: Europe/Istanbul saatiyle 04:00 — gece yarısı DEĞİL, bilinçli.
-- 00:00–03:59 arasındaki olaylar önceki güne sayılır.
--
-- Gerekçe:
-- 1. Uygulamanın kendi günü 04:00'da dönüyor (src/domain/studyDay.ts,
--    CLAUDE.md "Gün 04:00'da döner"). app_open.dueCount o güne göre
--    hesaplanıyor; analiz günü farklı olsaydı Leitner oranında pay
--    (wasDue self_eval) ile payda (dueCount) farklı günleri sayardı.
-- 2. Gece yarısını aşan tek bir oturum (23:30–00:30) gece yarısı sınırında
--    iki güne bölünür: DAU şişer, kurulum ertesi gün "geri dönmüş" sayılır ve
--    D1 yapay olarak yükselir.
--
-- Saat dilimi Europe/Istanbul, çünkü istemci kendi dilimini göndermiyor ve
-- kullanıcıların büyük kısmı Türkiye'de. Uygulama cihazın yerel saatini
-- kullanıyor; yurt dışındaki bir kullanıcının günü burada birkaç saat
-- kayabilir.
--
-- Her sorgunun başındaki `e` CTE'si study_day'i bu kuralla üretir. Kural bir
-- sorguda değişirse hepsinde değişmeli.
--
-- SINIRLAR.
-- * Satırlar 13 ay saklanır (AnalyticsRetentionJob): ondan eski kohortlar
--   eksik görünür.
-- * Bir kurulumun ilk olayı en fazla 7 gün geç gelebilir (çevrimdışı kuyruk):
--   son 7 günün sayıları sonradan artabilir.
-- * Opt-out eden kurulumlar hiç görünmez; oranlar ölçüme izin verenler içindir.


-- ---------------------------------------------------------------------------
-- 1a. Günlük aktif kurulum (DAU) — herhangi bir olay gönderen kurulumlar.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
)
SELECT study_day,
       count(DISTINCT install_id) AS active_installs
FROM e
WHERE study_day >= current_date - 90
GROUP BY study_day
ORDER BY study_day;


-- ---------------------------------------------------------------------------
-- 1b. DAU platforma göre.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
)
SELECT study_day,
       count(DISTINCT install_id) FILTER (WHERE platform = 'web')     AS web,
       count(DISTINCT install_id) FILTER (WHERE platform = 'android') AS android,
       count(DISTINCT install_id) FILTER (WHERE platform = 'ios')     AS ios
FROM e
WHERE study_day >= current_date - 90
GROUP BY study_day
ORDER BY study_day;


-- ---------------------------------------------------------------------------
-- 1c. Haftalık aktif kurulum (WAU) — takvim haftası, pazartesi başlar.
-- Son satır içinde bulunulan, henüz bitmemiş hafta.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
)
SELECT date_trunc('week', study_day)::date AS week_start,
       count(DISTINCT install_id)          AS active_installs
FROM e
WHERE study_day >= current_date - 7 * 26
GROUP BY week_start
ORDER BY week_start;


-- ---------------------------------------------------------------------------
-- 2a. D1 / D7 / D30 geri dönüş, ilk app_open gününe göre kohort.
--
-- DN: kohort gününden tam N gün sonra en az bir app_open olan kurulumların
-- kohorta oranı (tam gün tanımı, "N gün içinde" değil). Kohort günü + N
-- henüz tamamlanmadıysa oran NULL: eksik gün sıfır gibi görünmesin.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
),
opens AS (
    SELECT DISTINCT install_id, study_day FROM e WHERE event_name = 'app_open'
),
cohort AS (
    SELECT install_id, min(study_day) AS cohort_day FROM opens GROUP BY install_id
),
-- Bitmiş son gün: bugünün çalışma günü henüz sürüyor.
last_complete AS (
    SELECT ((now() AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date - 1 AS day
)
SELECT c.cohort_day,
       count(*) AS cohort_size,
       CASE WHEN c.cohort_day + 1 <= l.day THEN
           round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM opens o
               WHERE o.install_id = c.install_id AND o.study_day = c.cohort_day + 1)) / count(*), 1)
       END AS d1_pct,
       CASE WHEN c.cohort_day + 7 <= l.day THEN
           round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM opens o
               WHERE o.install_id = c.install_id AND o.study_day = c.cohort_day + 7)) / count(*), 1)
       END AS d7_pct,
       CASE WHEN c.cohort_day + 30 <= l.day THEN
           round(100.0 * count(*) FILTER (WHERE EXISTS (SELECT 1 FROM opens o
               WHERE o.install_id = c.install_id AND o.study_day = c.cohort_day + 30)) / count(*), 1)
       END AS d30_pct
FROM cohort c CROSS JOIN last_complete l
GROUP BY c.cohort_day, l.day
ORDER BY c.cohort_day;


-- ---------------------------------------------------------------------------
-- 2b. Aynı geri dönüş, tüm kohortların toplamı. Her DN yalnızca ölçülebilir
-- (kohort günü + N tamamlanmış) kurulumlar üzerinden hesaplanır.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
),
opens AS (
    SELECT DISTINCT install_id, study_day FROM e WHERE event_name = 'app_open'
),
cohort AS (
    SELECT install_id, min(study_day) AS cohort_day FROM opens GROUP BY install_id
),
last_complete AS (
    SELECT ((now() AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date - 1 AS day
),
flags AS (
    SELECT c.install_id, c.cohort_day,
           EXISTS (SELECT 1 FROM opens o WHERE o.install_id = c.install_id AND o.study_day = c.cohort_day + 1)  AS back_d1,
           EXISTS (SELECT 1 FROM opens o WHERE o.install_id = c.install_id AND o.study_day = c.cohort_day + 7)  AS back_d7,
           EXISTS (SELECT 1 FROM opens o WHERE o.install_id = c.install_id AND o.study_day = c.cohort_day + 30) AS back_d30
    FROM cohort c
)
SELECT count(*) FILTER (WHERE f.cohort_day + 1 <= l.day) AS d1_measurable,
       round(100.0 * count(*) FILTER (WHERE f.cohort_day + 1 <= l.day AND back_d1)
             / NULLIF(count(*) FILTER (WHERE f.cohort_day + 1 <= l.day), 0), 1) AS d1_pct,
       count(*) FILTER (WHERE f.cohort_day + 7 <= l.day) AS d7_measurable,
       round(100.0 * count(*) FILTER (WHERE f.cohort_day + 7 <= l.day AND back_d7)
             / NULLIF(count(*) FILTER (WHERE f.cohort_day + 7 <= l.day), 0), 1) AS d7_pct,
       count(*) FILTER (WHERE f.cohort_day + 30 <= l.day) AS d30_measurable,
       round(100.0 * count(*) FILTER (WHERE f.cohort_day + 30 <= l.day AND back_d30)
             / NULLIF(count(*) FILTER (WHERE f.cohort_day + 30 <= l.day), 0), 1) AS d30_pct
FROM flags f CROSS JOIN last_complete l;


-- ---------------------------------------------------------------------------
-- 3a. Leitner tekrar tamamlanma oranı, kurulum ve gün bazında.
--
-- completion = o gün wasDue=true olan self_eval sayısı
--              ÷ o günün İLK app_open'ındaki dueCount, en fazla 1.
-- dueCount = 0 olan günler hariç (yapılacak tekrar yok, oran tanımsız).
-- Gün içinde yeni vadesi gelen kart olursa pay paydayı aşabilir; tavan bu
-- yüzden 1.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
),
first_open AS (
    SELECT DISTINCT ON (install_id, study_day)
           install_id, study_day, (props ->> 'dueCount')::int AS due_count
    FROM e
    WHERE event_name = 'app_open'
    ORDER BY install_id, study_day, occurred_at, id
),
due_reviews AS (
    SELECT install_id, study_day, count(*) AS due_reviewed
    FROM e
    WHERE event_name = 'self_eval' AND (props ->> 'wasDue')::boolean
    GROUP BY install_id, study_day
)
SELECT f.install_id,
       f.study_day,
       f.due_count,
       coalesce(r.due_reviewed, 0) AS due_reviewed,
       round(LEAST(1.0, coalesce(r.due_reviewed, 0)::numeric / f.due_count), 3) AS completion
FROM first_open f
LEFT JOIN due_reviews r USING (install_id, study_day)
WHERE f.due_count > 0
ORDER BY f.study_day DESC, f.install_id;


-- ---------------------------------------------------------------------------
-- 3b. Günlük özet: ortalama tamamlanma ve vadesi gelenlerin TAMAMINI bitiren
-- kurulumların oranı. Yalnızca o gün dueCount > 0 ile açılan kurulumlar.
-- ---------------------------------------------------------------------------
WITH e AS (
    SELECT *, ((occurred_at AT TIME ZONE 'Europe/Istanbul') - INTERVAL '4 hours')::date AS study_day
    FROM analytics_event
),
first_open AS (
    SELECT DISTINCT ON (install_id, study_day)
           install_id, study_day, (props ->> 'dueCount')::int AS due_count
    FROM e
    WHERE event_name = 'app_open'
    ORDER BY install_id, study_day, occurred_at, id
),
due_reviews AS (
    SELECT install_id, study_day, count(*) AS due_reviewed
    FROM e
    WHERE event_name = 'self_eval' AND (props ->> 'wasDue')::boolean
    GROUP BY install_id, study_day
),
per_install_day AS (
    SELECT f.study_day,
           LEAST(1.0, coalesce(r.due_reviewed, 0)::numeric / f.due_count) AS completion
    FROM first_open f
    LEFT JOIN due_reviews r USING (install_id, study_day)
    WHERE f.due_count > 0
)
SELECT study_day,
       count(*)                                                       AS installs_with_due,
       round(avg(completion), 3)                                      AS avg_completion,
       round(100.0 * count(*) FILTER (WHERE completion >= 1) / count(*), 1) AS finished_all_pct
FROM per_install_day
GROUP BY study_day
ORDER BY study_day;


-- ---------------------------------------------------------------------------
-- 4a. Alias eşleşmesi × öz-değerlendirme matrisi (self_eval, adet).
-- Satır: uygulamanın kelime eşleşmesi (aliasResult), sütun: kullanıcının
-- kendi kararı (result). skipped: kullanıcı cevap yazmadan pas geçti.
-- ---------------------------------------------------------------------------
SELECT props ->> 'aliasResult'                                   AS alias_result,
       count(*) FILTER (WHERE props ->> 'result' = 'knew')       AS knew,
       count(*) FILTER (WHERE props ->> 'result' = 'partial')    AS partial,
       count(*) FILTER (WHERE props ->> 'result' = 'didnt')      AS didnt,
       count(*)                                                  AS total
FROM analytics_event
WHERE event_name = 'self_eval'
GROUP BY alias_result
ORDER BY array_position(ARRAY['match', 'partial', 'none', 'skipped'], props ->> 'aliasResult');


-- ---------------------------------------------------------------------------
-- 4b. Aynı matris satır yüzdesiyle: "eşleşme X dediğinde kullanıcı ne dedi?"
-- ---------------------------------------------------------------------------
SELECT props ->> 'aliasResult' AS alias_result,
       round(100.0 * count(*) FILTER (WHERE props ->> 'result' = 'knew')    / count(*), 1) AS knew_pct,
       round(100.0 * count(*) FILTER (WHERE props ->> 'result' = 'partial') / count(*), 1) AS partial_pct,
       round(100.0 * count(*) FILTER (WHERE props ->> 'result' = 'didnt')   / count(*), 1) AS didnt_pct,
       count(*) AS total
FROM analytics_event
WHERE event_name = 'self_eval'
GROUP BY alias_result
ORDER BY array_position(ARRAY['match', 'partial', 'none', 'skipped'], props ->> 'aliasResult');


-- ---------------------------------------------------------------------------
-- 4c. Uyuşma oranı ve Cohen's kappa (skipped hariç).
--
-- Köşegen: match↔knew, partial↔partial, none↔didnt.
-- agreement_pct ham uyuşma. Kategoriler dengesizse (ör. çoğu cevap "knew")
-- ham oran şans eseri de yüksek çıkar; kappa bu şans payını düşer:
-- 0 civarı şanstan farksız, 0.6 üstü iyi uyuşma.
-- ---------------------------------------------------------------------------
WITH pairs AS (
    SELECT CASE props ->> 'aliasResult'
               WHEN 'match'   THEN 'knew'
               WHEN 'partial' THEN 'partial'
               WHEN 'none'    THEN 'didnt'
           END                AS alias_as_result,
           props ->> 'result' AS result
    FROM analytics_event
    WHERE event_name = 'self_eval' AND props ->> 'aliasResult' <> 'skipped'
),
totals AS (
    SELECT count(*)::numeric AS n,
           count(*) FILTER (WHERE alias_as_result = result)::numeric AS agreed
    FROM pairs
),
expected AS (
    -- Şans eseri uyuşma: her kategori için iki tarafın marjinal oranlarının çarpımı.
    SELECT sum(a.cnt * r.cnt) / nullif(power((SELECT n FROM totals), 2), 0) AS p_e
    FROM (SELECT alias_as_result AS k, count(*)::numeric AS cnt FROM pairs GROUP BY 1) a
    JOIN (SELECT result AS k, count(*)::numeric AS cnt FROM pairs GROUP BY 1) r USING (k)
)
SELECT t.n::int                                         AS evaluated,
       round(100 * t.agreed / nullif(t.n, 0), 1)        AS agreement_pct,
       round((t.agreed / nullif(t.n, 0) - x.p_e) / nullif(1 - x.p_e, 0), 3) AS cohens_kappa
FROM totals t CROSS JOIN expected x;
