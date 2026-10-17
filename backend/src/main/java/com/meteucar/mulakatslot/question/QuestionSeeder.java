package com.meteucar.mulakatslot.question;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.ResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Uygulama açılışında classpath'teki soru içeriğini (frontend'den Maven
 * build'i kopyaladı) veritabanıyla senkronize eder. Doğrulama tamamen
 * bellekte biter; veritabanına ilk dokunuş yalnızca içerik geçerliyse olur.
 */
@Component
public class QuestionSeeder {

    private static final Logger log = LoggerFactory.getLogger(QuestionSeeder.class);

    /**
     * Güncelleme koşulu yazılan bütün kolonları karşılaştırır: category,
     * topic, difficulty ve kind payload'ın dışında, ayrı kolonlarda duruyor.
     * Koşul yalnızca payload'a baksaydı bu dört alandan yalnızca biri
     * değişen soru "değişmedi" sayılır ve sunucuya hiç yazılmazdı.
     *
     * "xmax = 0" satırın yeni mi eklendiğini yoksa ON CONFLICT ile mi
     * güncellendiğini ayırt etmek için kullanılıyor: xmax, satırı silen ya da
     * güncelleyen transaction'ın id'sidir; yeni eklenen bir satırda hiç
     * ayarlanmadığı için 0 kalır. Bu, Postgres'in belgelenmiş bir sözleşmesi
     * değil, iç depolama davranışı (sistem kolonu xmax) — resmi API değil.
     * Postgres sürüm yükseltmelerinde (major upgrade sonrası testlerde)
     * bu davranışın hâlâ geçerli olduğu doğrulanmalı.
     */
    private static final String UPSERT_SQL = """
            INSERT INTO question (id, category, topic, difficulty, kind, payload, updated_at)
            VALUES (?, ?, ?, ?, ?, ?::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET
                category = EXCLUDED.category,
                topic = EXCLUDED.topic,
                difficulty = EXCLUDED.difficulty,
                kind = EXCLUDED.kind,
                payload = EXCLUDED.payload,
                updated_at = now()
            WHERE (question.category, question.topic, question.difficulty, question.kind, question.payload)
                IS DISTINCT FROM (EXCLUDED.category, EXCLUDED.topic, EXCLUDED.difficulty, EXCLUDED.kind, EXCLUDED.payload)
            -- xmax = 0: belgelenmemiş iç davranış, yukarıdaki javadoc'a bakın.
            RETURNING (xmax = 0) AS inserted
            """;

    private static final String DELETE_STALE_SQL = "DELETE FROM question WHERE id NOT IN (:ids)";

    private final ResourcePatternResolver resourceResolver;
    private final JsonMapper jsonMapper;
    private final Validator validator;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedJdbcTemplate;
    private final PlatformTransactionManager transactionManager;
    private final String defaultContentLocation;

    public QuestionSeeder(ResourcePatternResolver resourceResolver, JsonMapper jsonMapper, Validator validator,
            JdbcTemplate jdbcTemplate, NamedParameterJdbcTemplate namedJdbcTemplate,
            PlatformTransactionManager transactionManager,
            @Value("${app.content.location:classpath:content/*.json}") String defaultContentLocation) {
        this.resourceResolver = resourceResolver;
        this.jsonMapper = jsonMapper;
        this.validator = validator;
        this.jdbcTemplate = jdbcTemplate;
        this.namedJdbcTemplate = namedJdbcTemplate;
        this.transactionManager = transactionManager;
        this.defaultContentLocation = defaultContentLocation;
    }

    @EventListener(ApplicationReadyEvent.class)
    public SeedResult seed() {
        return seed(defaultContentLocation);
    }

    /**
     * locationPattern parametreli: testler gerçek içeriğe bağlı kalmadan ayrı
     * bir content klasörü verebilsin diye.
     */
    public SeedResult seed(String locationPattern) {
        List<Resource> resources = loadContentResources(locationPattern);
        if (resources.isEmpty()) {
            throw new QuestionContentException("%s altında hiç içerik dosyası bulunamadı".formatted(locationPattern));
        }

        List<ContentFileDto> files = resources.stream().map(this::readAndValidate).toList();
        checkNoDuplicateIdsAcrossFiles(resources, files);

        List<ContentQuestionDto> allQuestions = files.stream().flatMap(f -> f.questions().stream()).toList();
        // Şu anki doğrulama kuralları (dosya başına en az 1 soru + yukarıdaki
        // "resources boş" kontrolü) bu durumu zaten engelliyor, ama silme
        // adımı hiçbir koşulda boş id listesiyle çalışmasın diye burada da
        // ayrıca durduruyoruz: aksi halde question_progress CASCADE ile tüm
        // kullanıcı ilerlemesi gider.
        if (allQuestions.isEmpty()) {
            throw new QuestionContentException(
                    "%s içinde hiç soru bulunamadı — güvenlik için durduruldu, mevcut veriye dokunulmadı"
                            .formatted(locationPattern));
        }

        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        SeedResult result = tx.execute(status -> upsertAndPrune(allQuestions));

        log.info("İçerik senkronizasyonu: {} eklendi, {} güncellendi, {} silindi, {} değişmedi",
                result.inserted(), result.updated(), result.deleted(), result.unchanged());
        return result;
    }

    private List<Resource> loadContentResources(String locationPattern) {
        try {
            Resource[] resources = resourceResolver.getResources(locationPattern);
            return Arrays.stream(resources)
                    .sorted(Comparator.comparing(Resource::getFilename))
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("İçerik dosyaları okunamadı: " + locationPattern, e);
        }
    }

    private ContentFileDto readAndValidate(Resource resource) {
        String filename = resource.getFilename();
        ContentFileDto dto;
        try (InputStream in = resource.getInputStream()) {
            dto = jsonMapper.readValue(in, ContentFileDto.class);
        } catch (IOException e) {
            // resource.getInputStream()'in kendisi (dosya açma/kapatma) — Jackson 3'te
            // readValue artık IOException değil, unchecked JacksonException fırlatıyor.
            throw new QuestionContentException("%s: dosya okunamadı — %s".formatted(filename, e.getMessage()));
        } catch (JacksonException e) {
            throw new QuestionContentException("%s: JSON parse edilemedi — %s".formatted(filename, e.getMessage()));
        }

        Set<ConstraintViolation<ContentFileDto>> violations = validator.validate(dto);
        if (!violations.isEmpty()) {
            throw new QuestionContentException(ContentViolationFormatter.describe(filename, dto, violations));
        }

        checkNoDuplicateIdsWithinFile(filename, dto);
        return dto;
    }

    private void checkNoDuplicateIdsWithinFile(String filename, ContentFileDto dto) {
        Set<String> seen = new HashSet<>();
        for (ContentQuestionDto q : dto.questions()) {
            if (!seen.add(q.id())) {
                throw new QuestionContentException("%s: tekrar eden id — %s".formatted(filename, q.id()));
            }
        }
    }

    private void checkNoDuplicateIdsAcrossFiles(List<Resource> resources, List<ContentFileDto> files) {
        Map<String, String> idToFile = new HashMap<>();
        for (int i = 0; i < files.size(); i++) {
            String filename = resources.get(i).getFilename();
            for (ContentQuestionDto q : files.get(i).questions()) {
                String existing = idToFile.putIfAbsent(q.id(), filename);
                if (existing != null) {
                    throw new QuestionContentException(
                            "%s: id '%s' zaten %s dosyasında tanımlı".formatted(filename, q.id(), existing));
                }
            }
        }
    }

    private SeedResult upsertAndPrune(List<ContentQuestionDto> questions) {
        int inserted = 0;
        int updated = 0;
        int unchanged = 0;
        Set<String> currentIds = new LinkedHashSet<>();

        for (ContentQuestionDto q : questions) {
            currentIds.add(q.id());
            String payloadJson = writePayload(q);
            List<Boolean> outcome = jdbcTemplate.query(UPSERT_SQL,
                    (rs, rowNum) -> rs.getBoolean("inserted"),
                    q.id(), q.category(), q.topic(), q.difficulty(), q.kind(), payloadJson);
            if (outcome.isEmpty()) {
                unchanged++;
            } else if (Boolean.TRUE.equals(outcome.get(0))) {
                inserted++;
            } else {
                updated++;
            }
        }

        int deleted = namedJdbcTemplate.update(DELETE_STALE_SQL, new MapSqlParameterSource("ids", currentIds));
        return new SeedResult(inserted, updated, deleted, unchanged);
    }

    private String writePayload(ContentQuestionDto q) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("prompt", q.prompt());
        payload.put("modelAnswer", q.modelAnswer());
        payload.put("keyConcepts", q.keyConcepts());
        if (q.followUps() != null) {
            payload.put("followUps", q.followUps());
        }
        if (q.source() != null) {
            payload.put("source", q.source());
        }
        // Jackson 3'te writeValueAsString unchecked JacksonException fırlatıyor,
        // sarmalayacak bir checked exception kalmadı.
        return jsonMapper.writeValueAsString(payload);
    }

    record SeedResult(int inserted, int updated, int deleted, int unchanged) {
    }
}
