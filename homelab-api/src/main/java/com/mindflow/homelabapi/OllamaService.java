package com.mindflow.homelabapi;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class OllamaService {

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
                List.of(new OllamaMessage("user", userMessage)),
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
