package com.mindflow.homelabapi;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChatMessageRepository
        extends JpaRepository<ChatMessage, Long> {

    List<ChatMessage> findTop20ByOrderByIdDesc();
    List<ChatMessage> findTop20ByConversationIdOrderByIdDesc(UUID conversationId);
}
