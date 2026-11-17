-- Kullanım ölçümü. Hesapla HİÇBİR bağ yok: user_id, IP ve user-agent
-- kolonu yok, app_user'a yabancı anahtar yok. install_id istemcinin
-- kurulumda ürettiği rastgele kimlik; giriş yapmış kullanıcıda da aynı.
-- Satırlar 13 ay sonra AnalyticsRetentionJob ile silinir.
CREATE TABLE analytics_event (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- İstemcinin ürettiği olay kimliği: ağ hatasından sonraki tekrar
    -- gönderim ON CONFLICT DO NOTHING ile çift kayıt üretmez.
    event_id UUID NOT NULL UNIQUE,
    install_id UUID NOT NULL,
    event_name TEXT NOT NULL
        CHECK (event_name IN ('app_open', 'spin', 'answer_submitted', 'self_eval')),
    platform TEXT NOT NULL CHECK (platform IN ('web', 'android', 'ios')),
    app_version TEXT NOT NULL,
    -- İstemci saati; doğrulama 7 gün geriye, 5 dakika ileriye izin veriyor.
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    props JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_analytics_event_install_occurred ON analytics_event (install_id, occurred_at);
CREATE INDEX idx_analytics_event_name_occurred ON analytics_event (event_name, occurred_at);
