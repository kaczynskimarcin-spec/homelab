package com.mindflow.homelabapi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class WebSearchService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public WebSearchService(
            @Value("${searxng.base-url:http://searxng:8080}")
            String searxngBaseUrl,
            ObjectMapper objectMapper
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(searxngBaseUrl)
                .build();

        this.objectMapper = objectMapper;
    }

    public String search(String query) {

        String json = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search")
                        .queryParam("q", query)
                        .queryParam("format", "json")
                        .build()
                )
                .retrieve()
                .body(String.class);

        if (json == null || json.isBlank()) {
            return "Brak wyników wyszukiwania.";
        }

        try {
            JsonNode root = objectMapper.readTree(json);

            JsonNode results = root.path("results");

            if (!results.isArray() || results.isEmpty()) {
                return "Brak wyników wyszukiwania.";
            }

            StringBuilder output = new StringBuilder();

            int limit = Math.min(results.size(), 5);

            for (int i = 0; i < limit; i++) {

                JsonNode result = results.get(i);

                String title =
                        result.path("title").asText("");

                String url =
                        result.path("url").asText("");

                String content =
                        result.path("content").asText("");

                output.append(i + 1)
                        .append(". ")
                        .append(title)
                        .append("\n");

                if (!url.isBlank()) {
                    output.append("URL: ")
                            .append(url)
                            .append("\n");
                }

                if (!content.isBlank()) {
                    output.append("Opis: ")
                            .append(content)
                            .append("\n");
                }

                output.append("\n");
            }

            return output.toString().trim();

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Nie udało się przetworzyć wyników wyszukiwania.",
                    e
            );
        }
    }
}