package com.mindflow.homelabapi;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MemoryItemRepository
        extends JpaRepository<MemoryItem, Long> {

    List<MemoryItem> findTop10ByOrderByImportanceDescIdDesc();
}