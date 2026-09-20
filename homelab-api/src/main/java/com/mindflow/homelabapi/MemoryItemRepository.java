package com.mindflow.homelabapi;

import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoryItemRepository
        extends JpaRepository<MemoryItem, Long> {
}