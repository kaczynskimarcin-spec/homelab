package com.mindflow.homelabapi;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class WebSearchService {

    private final RestClient restClient;

    public WebSearchService(
            @Value("${searxng.base-url:http://searxng:8080}")
            String searxngBaseUrl
    ) {
        this.restClient = RestClient.builder()
                .baseUrl(searxngBaseUrl)
                .build();
    }

    public String search(String query) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/search")
                        .queryParam("q", query)
                        .queryParam("format", "json")
                        .build()
                )
                .retrieve()
                .body(String.class);
    }
}