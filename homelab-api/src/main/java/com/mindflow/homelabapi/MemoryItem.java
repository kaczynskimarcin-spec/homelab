package com.mindflow.homelabapi;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "memory_items")
public class MemoryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MemoryType type;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private Integer importance;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    protected MemoryItem() {
    }

    public MemoryItem(
            MemoryType type,
            String content,
            Integer importance
    ) {
        this.type = type;
        this.content = content;
        this.importance = importance;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public MemoryType getType() {
        return type;
    }

    public String getContent() {
        return content;
    }

    public Integer getImportance() {
        return importance;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
