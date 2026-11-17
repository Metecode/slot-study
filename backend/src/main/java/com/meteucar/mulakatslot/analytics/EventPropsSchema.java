package com.meteucar.mulakatslot.analytics;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Olay adları ve her olayın izin verilen props alanları. İstemci de aynı
 * şemayı kullanıyor; bir alan eklenirse iki tarafta birlikte değişir.
 *
 * <p>Listedeki her alan zorunlu. Listede olmayan alanlar atılır, olayı
 * geçersiz kılmaz: yeni sürüm istemci eski sunucuya yeni bir alan
 * gönderdiğinde olay kaybolmasın.
 *
 * <p>Ad listesi V4 migration'ındaki CHECK kısıtıyla aynı olmalı.
 */
final class EventPropsSchema {

    /** Bir props alanının kabul ettiği değer. */
    sealed interface FieldRule permits IntRange, BooleanField, IdField, OneOf {
        boolean accepts(Object value);
    }

    /**
     * Tam sayı, sınırlar dahil. Ondalık (3.0 dahil) ve metin olarak sayı
     * kabul edilmez: istemcinin bir hatasını sessizce düzeltmek, sorgularda
     * görünmeyen bir tutarsızlık bırakırdı.
     */
    record IntRange(long min, long max) implements FieldRule {
        @Override
        public boolean accepts(Object value) {
            if (value instanceof Integer || value instanceof Long
                    || value instanceof Short || value instanceof Byte) {
                long number = ((Number) value).longValue();
                return number >= min && number <= max;
            }
            // Long'a sığmayan bir sayı zaten aralık dışında.
            return false;
        }
    }

    record BooleanField() implements FieldRule {
        @Override
        public boolean accepts(Object value) {
            return value instanceof Boolean;
        }
    }

    /**
     * Soru kimliği. Karakter kümesi dar tutuldu: NUL ve eşi olmayan
     * surrogate JSONB yazmasını düşürürdü, serbest metin de bu tabloya
     * hiç girmesin.
     */
    record IdField() implements FieldRule {
        private static final Pattern ID = Pattern.compile("^[A-Za-z0-9._-]{1,128}$");

        @Override
        public boolean accepts(Object value) {
            return value instanceof String text && ID.matcher(text).matches();
        }
    }

    record OneOf(Set<String> allowed) implements FieldRule {
        @Override
        public boolean accepts(Object value) {
            return value instanceof String text && allowed.contains(text);
        }
    }

    /** Kutu aralığı: question_progress.box CHECK'iyle aynı. */
    private static final IntRange BOX = new IntRange(1, 5);

    /** Cevap uzunluğu: ProgressValidator.MAX_ANSWER_LENGTH ile aynı sınır. */
    private static final IntRange ANSWER_LENGTH = new IntRange(0, 5000);

    private static final Map<String, Map<String, FieldRule>> SCHEMAS = Map.of(
            // dueCount: açılış anında vadesi gelmiş kart sayısı.
            "app_open", Map.of(
                    "dueCount", new IntRange(0, 10_000)),
            "spin", Map.of(
                    "categoryCount", new IntRange(1, 100)),
            // Cevap METNİ değil, yalnızca uzunluğu.
            "answer_submitted", Map.of(
                    "questionId", new IdField(),
                    "answerLength", ANSWER_LENGTH),
            // box: öz-değerlendirmeden SONRAKİ kutu.
            "self_eval", Map.of(
                    "questionId", new IdField(),
                    "aliasResult", new OneOf(Set.of("match", "partial", "none", "skipped")),
                    "result", new OneOf(Set.of("knew", "partial", "didnt")),
                    "box", BOX,
                    "wasDue", new BooleanField()));

    private EventPropsSchema() {
    }

    static boolean isKnownEvent(String name) {
        return name != null && SCHEMAS.containsKey(name);
    }

    /** Bilinen bir olayın alanları; {@link #isKnownEvent} ile kontrol edildikten sonra çağrılır. */
    static Map<String, FieldRule> fieldsOf(String name) {
        return SCHEMAS.get(name);
    }

    static Set<String> eventNames() {
        return SCHEMAS.keySet();
    }
}
