package com.mindflow.homelabapi;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final OllamaService ollamaService;
    private final ChatMessageRepository chatMessageRepository;

    public AiController(
            OllamaService ollamaService,
            ChatMessageRepository chatMessageRepository) {

        this.ollamaService = ollamaService;
        this.chatMessageRepository = chatMessageRepository;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest request) {

        if (request.message() == null || request.message().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Message cannot be empty"
            );
        }

        chatMessageRepository.save(
                new ChatMessage("user", request.message())
        );

        String response = ollamaService.chat(request.message());

        chatMessageRepository.save(
                new ChatMessage("assistant", response)
        );

        return new ChatResponse(response);
    }

    public record ChatRequest(String message) {}

    public record ChatResponse(String response) {}
}
