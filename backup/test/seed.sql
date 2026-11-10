-- Yerel yedek denemesi için örnek veri. Canlı şemayla ilgisi yok; yalnızca
-- geri yüklemede satır sayısını karşılaştırmak için.
CREATE TABLE demo (id integer PRIMARY KEY, note text NOT NULL);
INSERT INTO demo SELECT g, md5(g::text) FROM generate_series(1, 5000) AS g;
