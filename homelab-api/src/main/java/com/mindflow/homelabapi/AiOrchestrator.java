package com.mindflow.homelabapi;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AiOrchestrator {

    private final AiProvider aiProvider;

    public AiOrchestrator(AiProvider aiProvider) {
        this.aiProvider = aiProvider;
    }

    public String chat(
            String message,
            List<ChatMessage> history
    ) {
        return aiProvider.chat(
                message,
                history
        );
    }
}
