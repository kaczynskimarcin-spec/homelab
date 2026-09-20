package com.mindflow.homelabapi;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/memory")
public class MemoryController {

    private final MemoryItemRepository memoryItemRepository;

    public MemoryController(
            MemoryItemRepository memoryItemRepository
    ) {
        this.memoryItemRepository = memoryItemRepository;
    }

    @PostMapping
    public MemoryResponse saveMemory(
            @RequestBody MemoryRequest request
    ) {

        if (request.type() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Memory type cannot be empty"
            );
        }

        if (request.content() == null ||
                request.content().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Memory content cannot be empty"
            );
        }

        int importance = request.importance();

        if (importance < 1 || importance > 10) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Importance must be between 1 and 10"
            );
        }

        MemoryItem memoryItem =
                new MemoryItem(
                        request.type(),
                        request.content().trim(),
                        importance
                );

        MemoryItem savedMemory =
                memoryItemRepository.save(
                        memoryItem
                );

        return new MemoryResponse(
                savedMemory.getId(),
                savedMemory.getType(),
                savedMemory.getContent(),
                savedMemory.getImportance()
        );
    }

    public record MemoryRequest(
            MemoryType type,
            String content,
            int importance
    ) {}

    public record MemoryResponse(
            Long id,
            MemoryType type,
            String content,
            Integer importance
    ) {}
}