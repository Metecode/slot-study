package com.meteucar.mulakatslot.question;

import static org.assertj.core.api.Assertions.assertThat;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Adımlar birbirine bağlı: her test bir öncekinin bıraktığı içerik
 * klasörünü değiştirip seeder'ı tekrar çalıştırıyor, bu yüzden sıralı.
 */
@Import(TestcontainersConfiguration.class)
@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class QuestionSeederTest {

    // Alfa sorusunun adım adım hâlleri: her adım bir öncekinden yalnızca bir alanla ayrılır.
    private static final Alpha ALPHA_INITIAL = new Alpha("sql", "Alfa Konu", 2, "definition",
            "Alfa üzerine ilk soru metnidir, yeterince uzun tutuldu.");
    private static final Alpha ALPHA_NEW_ANSWER =
            ALPHA_INITIAL.withModelAnswer("Alfa üzerine değişen ve güncellenmiş soru metnidir.");
    private static final Alpha ALPHA_NEW_TOPIC = ALPHA_NEW_ANSWER.withTopic("Alfa Yeni Konu");
    private static final Alpha ALPHA_NEW_DIFFICULTY = ALPHA_NEW_TOPIC.withDifficulty(3);
    private static final Alpha ALPHA_NEW_KIND = ALPHA_NEW_DIFFICULTY.withKind("applied");
    private static final Alpha ALPHA_NEW_CATEGORY = ALPHA_NEW_KIND.withCategory("docker");

    @TempDir
    static Path contentDir;

    @Autowired
    private QuestionSeeder questionSeeder;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void contentLocation(DynamicPropertyRegistry registry) {
        registry.add("app.content.location", () -> "file:" + contentDir + "/*.json");
    }

    @BeforeAll
    static void writeInitialFixture() throws IOException {
        writeFixture(ALPHA_INITIAL);
    }

    @Test
    @Order(1)
    void firstRunInsertsAllQuestions() {
        assertThat(questionRepository.findAllById(List.of("seed-test-alpha", "seed-test-beta")))
                .hasSize(2);
    }

    @Test
    @Order(2)
    void secondRunWithSameContentChangesNothing() {
        assertSeedWritesNoRow();
    }

    @Test
    @Order(3)
    void changingOnePayloadUpdatesOnlyThatQuestion() throws IOException {
        Question alpha = seedAndExpectOnlyAlphaUpdated(ALPHA_NEW_ANSWER);

        assertThat(alpha.getPayload()).containsEntry("modelAnswer", ALPHA_NEW_ANSWER.modelAnswer());
    }

    /*
     * 4–7: payload aynı kalıp yalnızca ayrı kolonda tutulan bir alan değişiyor.
     * Güncelleme koşulu yalnızca payload'ı karşılaştırsaydı bu değişiklikler
     * sunucuya hiç yazılmazdı.
     */

    @Test
    @Order(4)
    void changingOnlyTopicUpdatesTheRow() throws IOException {
        Question alpha = seedAndExpectOnlyAlphaUpdated(ALPHA_NEW_TOPIC);

        assertThat(alpha.getTopic()).isEqualTo(ALPHA_NEW_TOPIC.topic());
    }

    @Test
    @Order(5)
    void changingOnlyDifficultyUpdatesTheRow() throws IOException {
        Question alpha = seedAndExpectOnlyAlphaUpdated(ALPHA_NEW_DIFFICULTY);

        assertThat(alpha.getDifficulty()).isEqualTo((short) ALPHA_NEW_DIFFICULTY.difficulty());
    }

    @Test
    @Order(6)
    void changingOnlyKindUpdatesTheRow() throws IOException {
        Question alpha = seedAndExpectOnlyAlphaUpdated(ALPHA_NEW_KIND);

        assertThat(alpha.getKind()).isEqualTo(ALPHA_NEW_KIND.kind());
    }

    @Test
    @Order(7)
    void changingOnlyCategoryUpdatesTheRow() throws IOException {
        Question alpha = seedAndExpectOnlyAlphaUpdated(ALPHA_NEW_CATEGORY);

        assertThat(alpha.getCategory()).isEqualTo(ALPHA_NEW_CATEGORY.category());
    }

    @Test
    @Order(8)
    void reseedingAfterColumnChangesWritesNoRow() {
        // Tüm kolonları karşılaştıran koşul, değişiklik yokken gereksiz UPDATE üretmemeli.
        assertSeedWritesNoRow();
    }

    @Test
    @Order(9)
    void removingAQuestionFromJsonDeletesItFromDatabase() throws IOException {
        Files.writeString(contentDir.resolve("round.json"), """
                {
                  "lang": "tr",
                  "category": "sql",
                  "questions": [%s]
                }
                """.formatted(betaJson()));

        QuestionSeeder.SeedResult result = questionSeeder.seed();

        assertThat(result.deleted()).isEqualTo(1);
        assertThat(result.unchanged()).isEqualTo(1);
        assertThat(questionRepository.findById("seed-test-alpha")).isEmpty();
        assertThat(questionRepository.findById("seed-test-beta")).isPresent();
    }

    /** İçerik değişmeden seed: hiçbir satıra yazılmamalı. */
    private void assertSeedWritesNoRow() {
        String alphaXmin = xminOf("seed-test-alpha");
        String betaXmin = xminOf("seed-test-beta");
        OffsetDateTime alphaBefore = updatedAtOf("seed-test-alpha");
        OffsetDateTime betaBefore = updatedAtOf("seed-test-beta");

        QuestionSeeder.SeedResult result = questionSeeder.seed();

        assertThat(result.inserted()).isZero();
        assertThat(result.updated()).isZero();
        assertThat(result.deleted()).isZero();
        assertThat(result.unchanged()).isEqualTo(2);
        assertThat(xminOf("seed-test-alpha")).isEqualTo(alphaXmin);
        assertThat(xminOf("seed-test-beta")).isEqualTo(betaXmin);
        assertThat(updatedAtOf("seed-test-alpha")).isEqualTo(alphaBefore);
        assertThat(updatedAtOf("seed-test-beta")).isEqualTo(betaBefore);
    }

    /** Yalnızca alfa değişti: alfa güncellenmeli, beta satırına hiç yazılmamalı. */
    private Question seedAndExpectOnlyAlphaUpdated(Alpha alpha) throws IOException {
        String betaXmin = xminOf("seed-test-beta");

        writeFixture(alpha);
        QuestionSeeder.SeedResult result = questionSeeder.seed();

        assertThat(result.updated()).isEqualTo(1);
        assertThat(result.unchanged()).isEqualTo(1);
        assertThat(result.inserted()).isZero();
        assertThat(result.deleted()).isZero();
        assertThat(xminOf("seed-test-beta")).isEqualTo(betaXmin);

        Question saved = questionRepository.findById("seed-test-alpha").orElseThrow();
        assertThat(saved.getPayload()).containsEntry("modelAnswer", alpha.modelAnswer());
        return saved;
    }

    private OffsetDateTime updatedAtOf(String id) {
        Optional<Question> question = questionRepository.findById(id);
        assertThat(question).isPresent();
        return question.get().getUpdatedAt();
    }

    /**
     * Postgres her UPDATE'te satırın yeni bir sürümünü yazar ve xmin değişir,
     * değerler aynı olsa bile. xmin'in aynı kalması satıra hiç yazılmadığını
     * gösterir; updated_at karşılaştırmasından daha kesin bir kanıt.
     */
    private String xminOf(String id) {
        return jdbcTemplate.queryForObject("SELECT xmin::text FROM question WHERE id = ?", String.class, id);
    }

    private static void writeFixture(Alpha alpha) throws IOException {
        Files.writeString(contentDir.resolve("round.json"), """
                {
                  "lang": "tr",
                  "category": "sql",
                  "questions": [%s, %s]
                }
                """.formatted(alphaJson(alpha), betaJson()));
    }

    private static String alphaJson(Alpha alpha) {
        return """
                {
                  "id": "seed-test-alpha",
                  "category": "%s",
                  "topic": "%s",
                  "difficulty": %d,
                  "kind": "%s",
                  "prompt": "Alfa sorusu nedir ve neden vardır?",
                  "modelAnswer": "%s",
                  "keyConcepts": [
                    {"id": "a1", "label": "Kavram A1", "aliases": ["a1"], "anchors": ["Bu alfa kavramı bir için çapa cümlesidir."]},
                    {"id": "a2", "label": "Kavram A2", "aliases": ["a2"], "anchors": ["Bu alfa kavramı iki için çapa cümlesidir."]},
                    {"id": "a3", "label": "Kavram A3", "aliases": ["a3"], "anchors": ["Bu alfa kavramı üç için çapa cümlesidir."]}
                  ]
                }
                """.formatted(alpha.category(), alpha.topic(), alpha.difficulty(), alpha.kind(), alpha.modelAnswer());
    }

    private static String betaJson() {
        return """
                {
                  "id": "seed-test-beta",
                  "category": "react",
                  "topic": "Beta Konu",
                  "difficulty": 1,
                  "kind": "applied",
                  "prompt": "Beta sorusu nedir ve neden vardır?",
                  "modelAnswer": "Beta üzerine sabit kalan, hiç değişmeyen soru metnidir.",
                  "keyConcepts": [
                    {"id": "b1", "label": "Kavram B1", "aliases": ["b1"], "anchors": ["Bu beta kavramı bir için çapa cümlesidir."]},
                    {"id": "b2", "label": "Kavram B2", "aliases": ["b2"], "anchors": ["Bu beta kavramı iki için çapa cümlesidir."]},
                    {"id": "b3", "label": "Kavram B3", "aliases": ["b3"], "anchors": ["Bu beta kavramı üç için çapa cümlesidir."]}
                  ]
                }
                """;
    }

    /** Alfa sorusunun testlerde değişen alanları; prompt ve kavramlar sabit. */
    private record Alpha(String category, String topic, int difficulty, String kind, String modelAnswer) {

        Alpha withModelAnswer(String value) {
            return new Alpha(category, topic, difficulty, kind, value);
        }

        Alpha withTopic(String value) {
            return new Alpha(category, value, difficulty, kind, modelAnswer);
        }

        Alpha withDifficulty(int value) {
            return new Alpha(category, topic, value, kind, modelAnswer);
        }

        Alpha withKind(String value) {
            return new Alpha(category, topic, difficulty, value, modelAnswer);
        }

        Alpha withCategory(String value) {
            return new Alpha(value, topic, difficulty, kind, modelAnswer);
        }
    }
}
