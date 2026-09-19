package com.mindflow.homelabapi;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
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

            PAMIĘĆ
            - Możesz otrzymywać wcześniejsze wiadomości zapisane w PostgreSQL.
            - Traktuj przekazaną historię jako wcześniejszy kontekst rozmowy.
            - Nie twierdź, że pamiętasz informacje, których nie ma w przekazanej historii.
            - Obecna pamięć rozmowy nie jest jeszcze pełną pamięcią długoterminową.

            STAN SYSTEMU
            Przy każdej wiadomości otrzymujesz aktualny SYSTEM STATE.
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

    public String chat(
            String userMessage,
            List<ChatMessage> history) {

        String systemState =
                buildSystemState();

        List<OllamaMessage> messages =
                new ArrayList<>();

        /*
         * 1. Tożsamość + aktualny stan systemu.
         */
        messages.add(
                new OllamaMessage(
                        "system",
                        SYSTEM_PROMPT +
                                "\n\n" +
                                systemState
                )
        );

        /*
         * 2. Historia pobrana z PostgreSQL.
         *
         * AiController przekazuje ją już:
         * oldest -> newest
         */
        for (ChatMessage message : history) {

            messages.add(
                    new OllamaMessage(
                            message.getRole(),
                            message.getContent()
                    )
            );
        }

        /*
         * 3. Aktualna wiadomość użytkownika.
         */
        messages.add(
                new OllamaMessage(
                        "user",
                        userMessage
                )
        );

        OllamaRequest request =
                new OllamaRequest(
                        model,
                        messages,
                        GENERATION_OPTIONS,
                        false,
                        false
                );

        OllamaResponse response =
                restClient.post()
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

                chat_storage: true
                recent_conversation_history: true
                long_term_memory: false

                web_search: false
                web_fetch: false
                browser_control: false
                homelab_tools: false

                memory_notes:
                - Backend zapisuje wiadomości do PostgreSQL.
                - Backend przekazuje Ci ostatnie wiadomości jako kontekst rozmowy.
                - Możesz korzystać tylko z historii faktycznie przekazanej w bieżącym requestcie.
                - Nie posiadasz jeszcze pełnej pamięci długoterminowej.
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