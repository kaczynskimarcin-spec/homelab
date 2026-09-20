package com.mindflow.homelabapi;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MemoryService {

    private final MemoryItemRepository memoryItemRepository;

    public MemoryService(
            MemoryItemRepository memoryItemRepository
    ) {
        this.memoryItemRepository = memoryItemRepository;
    }

    public String buildMemoryContext() {

        List<MemoryItem> memories =
                memoryItemRepository
                        .findTop10ByOrderByImportanceDescIdDesc();

        if (memories.isEmpty()) {
            return "Brak zapisanej pamięci długoterminowej.";
        }

        StringBuilder context = new StringBuilder();

        context.append("LONG TERM MEMORY:\n");

        for (MemoryItem memory : memories) {
            context.append("- [")
                    .append(memory.getType())
                    .append("] ")
                    .append(memory.getContent())
                    .append("\n");
        }

        return context.toString().trim();
    }
}
