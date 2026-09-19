package com.mindflow.homelabapi;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
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

        if (request.message() == null ||
                request.message().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Message cannot be empty"
            );
        }
        UUID conversationId = request.conversationId();

        if (conversationId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Conversation ID cannot be empty"
            );
        }

        /*
         * Pobieramy historię PRZED zapisaniem
         * aktualnej wiadomości użytkownika.
         *
         * Dzięki temu current user message
         * nie pojawi się Qwenowi dwa razy.
         */
        List<ChatMessage> history =
                chatMessageRepository
                        .findTop20ByConversationIdOrderByIdDesc(
                                conversationId
                        );
        /*
         * Repository zwraca:
         * newest -> oldest
         *
         * Qwen potrzebuje:
         * oldest -> newest
         */
        Collections.reverse(history);

        /*
         * Zapis aktualnej wiadomości.
         */
        ChatMessage userMessage =
                new ChatMessage(
                        "user",
                        request.message()
                );

        userMessage.setConversationId(
                conversationId
        );

        chatMessageRepository.save(
                userMessage
        );

        /*
         * Historia + aktualne pytanie
         * trafiają do OllamaService.
         */
        String response =
                ollamaService.chat(
                        request.message(),
                        history
                );

        /*
         * Zapis odpowiedzi AI.
         */
        ChatMessage assistantMessage =
                new ChatMessage(
                        "assistant",
                        response
                );

        assistantMessage.setConversationId(
                conversationId
        );

        chatMessageRepository.save(
                assistantMessage
        );

        return new ChatResponse(response);
    }

    public record ChatRequest(
            String message,
            UUID conversationId
    ) {}

    public record ChatResponse(
            String response
    ) {}
}