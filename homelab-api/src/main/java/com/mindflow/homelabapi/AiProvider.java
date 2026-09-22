package com.mindflow.homelabapi;

import java.util.List;

public interface AiProvider {

    String chat(
            String message,
            List<ChatMessage> history
    );
}