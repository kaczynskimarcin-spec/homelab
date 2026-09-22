package com.mindflow.homelabapi;

import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class OllamaProvider implements AiProvider {

    private final OllamaService ollamaService;

    public OllamaProvider(OllamaService ollamaService) {
        this.ollamaService = ollamaService;
    }

    @Override
    public String chat(
            String message,
            List<ChatMessage> history
    ) {
        return ollamaService.chat(
                message,
                history
        );
    }
}
