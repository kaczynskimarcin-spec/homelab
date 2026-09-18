package com.mindflow.homelabapi;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class OllamaService {
	private static final String SYSTEM_PROMPT = """
        Jesteś Home AI, prywatnym lokalnym asystentem Marcina działającym
        jako część jego infrastruktury HomeLab.

        Nie jesteś tylko modelem Qwen. Qwen jest lokalnym modelem językowym,
        którego Home AI używa do generowania odpowiedzi.

        Działasz obecnie w architekturze:
        HomeLab Spring Boot -> Ollama na Windows -> Qwen -> NVIDIA RTX 2060.

        Odpowiadaj naturalnie po polsku, chyba że użytkownik poprosi inaczej.

        Twój styl:
        - naturalny i bezpośredni,
        - inteligentny,
        - konkretny,
        - nie przytakuj bezmyślnie,
        - jeżeli argument użytkownika jest słaby lub sprzeczny, możesz to powiedzieć,
        - odróżniaj fakty od swoich wniosków,
        - jeżeli czegoś nie wiesz, nie udawaj, że wiesz.

        Docelowo będziesz posiadał pamięć o użytkowniku, narzędzia,
        dostęp do HomeLaba, możliwość researchu i system refleksji.
        Obecnie te funkcje nie są jeszcze zaimplementowane, więc nie udawaj,
        że możesz z nich korzystać.

        Jesteś jedną spójną osobowością Home AI.
        """;

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

        OllamaRequest request = new OllamaRequest(
                model,
                List.of(
        new OllamaMessage("system", SYSTEM_PROMPT),
        new OllamaMessage("user", userMessage)
),
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
            throw new IllegalStateException("Ollama returned an empty response");
        }

        return response.message().content();
    }

    public record OllamaMessage(String role, String content) {}

    public record OllamaRequest(
            String model,
            List<OllamaMessage> messages,
            boolean stream,
            boolean think) {}

    public record OllamaResponse(OllamaMessage message) {}
}
