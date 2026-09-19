package com.mindflow.homelabapi;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class OllamaService {

    private static final ZoneId HOME_TIME_ZONE =
            ZoneId.of("Europe/Warsaw");

    private static final DateTimeFormatter TIME_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss z");

    private static final String SYSTEM_PROMPT = """
            Jesteś Home AI, prywatnym lokalnym asystentem Marcina działającym
            jako część jego infrastruktury HomeLab.

            TOŻSAMOŚĆ
            - Nazywasz się Home AI.
            - Qwen jest modelem językowym, którego używasz do generowania odpowiedzi.
            - Nie przedstawiaj się jako Qwen.
            - Działasz jako część systemu HomeLab.

            SPOSÓB MÓWIENIA
            - Mów naturalnym, współczesnym polskim.
            - Mów jak inteligentny człowiek, nie jak instrukcja obsługi ani chatbot korporacyjny.
            - Jeżeli użytkownik pisze swobodnie, możesz odpowiadać swobodnie.
            - Nie zaczynaj każdej odpowiedzi od powitania.
            - Najpierw odpowiedz bezpośrednio na pytanie.
            - Dopiero później dodaj wyjaśnienie, jeśli jest potrzebne.
            - Preferuj proste i klarowne zdania.
            - Nie używaj sztucznych, książkowych ani przesadnie formalnych konstrukcji.
            - Używaj normalnych nazw technicznych.
            - Nie rozpisuj prostych odpowiedzi bez potrzeby.
            - Unikaj powtarzania informacji.

            JAKOŚĆ ODPOWIEDZI
            - Bądź konkretny.
            - Nie przytakuj bezmyślnie.
            - Jeżeli użytkownik się myli, możesz powiedzieć to wprost.
            - Odróżniaj fakty od własnych wniosków.
            - Jeżeli czegoś nie wiesz, powiedz, że tego nie wiesz.
            - Nie wymyślaj faktów.
            - Nie twórz nienaturalnych polskich sformułowań.

            STAN SYSTEMU
            Przy każdej wiadomości otrzymujesz osobny aktualny SYSTEM STATE.
            Traktuj go jako źródło prawdy o:
            - aktualnym czasie,
            - modelu,
            - swoich możliwościach.

            Nie twierdź, że posiadasz możliwość oznaczoną jako false.

            Sam URL nie daje Ci dostępu do zawartości strony.
            Możesz analizować stronę dopiero wtedy, gdy system faktycznie przekaże Ci jej treść.

            Jesteś jedną spójną osobowością Home AI.
            """;

    private static final Map<String, Object> GENERATION_OPTIONS = Map.of(
            "temperature", 0.35,
            "top_k", 30,
            "top_p", 0.85,
            "repeat_penalty", 1.1
    );

    private final RestClient restClient;
    private final String model;

    public OllamaService(
            @Value("${ollama.base-url}") String baseUrl,
            @Value("${ollama.model}") String model) {

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();

        this.model = model;
    }

    public String chat(String userMessage) {

        String systemState = buildSystemState();

        OllamaRequest request = new OllamaRequest(
                model,
                List.of(
                        new OllamaMessage(
                                "system",
                                SYSTEM_PROMPT + "\n\n" + systemState
                        ),
                        new OllamaMessage(
                                "user",
                                userMessage
                        )
                ),
                GENERATION_OPTIONS,
                false,
                false
        );

        OllamaResponse response = restClient.post()
                .uri("/api/chat")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(OllamaResponse.class);

        if (response == null ||
                response.message() == null ||
                response.message().content() == null) {

            throw new IllegalStateException(
                    "Ollama returned an empty response"
            );
        }

        return response.message().content();
    }

    private String buildSystemState() {

        ZonedDateTime now =
                ZonedDateTime.now(HOME_TIME_ZONE);

        return """
                SYSTEM STATE

                current_datetime: %s
                timezone: Europe/Warsaw

                model:
                name: %s

                capabilities:
                chat: true
                memory_write: true
                memory_read: false
                web_search: false
                web_fetch: false
                browser_control: false
                homelab_tools: false

                capability_notes:
                - memory_write=true oznacza, że backend zapisuje rozmowy do PostgreSQL.
                - memory_read=false oznacza, że nie otrzymujesz jeszcze wcześniejszych rozmów.
                - web_search=false oznacza, że nie możesz obecnie wyszukiwać internetu.
                - web_fetch=false oznacza, że nie możesz obecnie pobierać treści stron.
                """.formatted(
                now.format(TIME_FORMAT),
                model
        );
    }

    public record OllamaMessage(
            String role,
            String content
    ) {}

    public record OllamaRequest(
            String model,
            List<OllamaMessage> messages,
            Map<String, Object> options,
            boolean stream,
            boolean think
    ) {}

    public record OllamaResponse(
            OllamaMessage message
    ) {}
}