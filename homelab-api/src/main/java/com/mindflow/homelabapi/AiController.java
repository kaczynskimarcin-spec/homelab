package com.mindflow.homelabapi;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final OllamaService ollamaService;

    public AiController(OllamaService ollamaService) {
        this.ollamaService = ollamaService;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest request) {

        if (request.message() == null || request.message().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Message cannot be empty"
            );
        }

        String response = ollamaService.chat(request.message());

        return new ChatResponse(response);
    }

    public record ChatRequest(String message) {}

    public record ChatResponse(String response) {}
}
